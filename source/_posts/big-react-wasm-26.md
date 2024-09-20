---
title: 从零实现 React v18，但 WASM 版 - [26] 实现 React.lazy
date: 2024-09-19 18:18:28
tags:
  - wasm
  - react
categories:
  - rust
---

> 模仿 [big-react](https://github.com/BetaSu/big-react)，使用 Rust 和 WebAssembly，从零实现 React v18 的核心功能。深入理解 React 源码的同时，还锻炼了 Rust 的技能，简直赢麻了！
>
> 代码地址：https://github.com/ParadeTo/big-react-wasm
>
> 本文对应 tag：[v26](https://github.com/ParadeTo/big-react-wasm/tree/v26)

Suspense 另外一个比较有用的功能是结合 React.lazy 进行组件懒加载，我们继续来实现一下，本次改动详见[这里](https://github.com/ParadeTo/big-react-wasm/pull/28)。

我们用下面这个例子来进行说明：

```js
import {Suspense, lazy} from 'react'

function delay(promise) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(promise)
    }, 2000)
  })
}

const Cpn = lazy(() => import('./Cpn').then((res) => delay(res)))

export default function App() {
  return (
    <Suspense fallback={<div>loading</div>}>
      <Cpn />
    </Suspense>
  )
}
```

首先，还是要在 react 这个库中导出这个方法：

```rust
#[wasm_bindgen]
pub fn lazy(ctor: &JsValue) -> JsValue {
    let payload = Object::new();
    Reflect::set(&payload, &"_status".into(), &JsValue::from(UNINITIALIZED));
    Reflect::set(&payload, &"_result".into(), ctor);

    let lazy_type = Object::new();

    Reflect::set(
        &lazy_type,
        &"$$typeof".into(),
        &JsValue::from_str(REACT_LAZY_TYPE),
    );
    Reflect::set(&lazy_type, &"_payload".into(), &payload);
    let closure = Closure::wrap(
        Box::new(lazy_initializer) as Box<dyn Fn(JsValue) -> Result<JsValue, JsValue>>
    );
    let f = closure.as_ref().unchecked_ref::<Function>().clone();
    closure.forget();
    Reflect::set(&lazy_type, &"_init".into(), &f);
    lazy_type.into()
}
```

翻译成 JS 更直观，如下所示：

```js
const payload = {
  _status: UNINITIALIZED,
  _result: ctor,
}

const lazy_type = {
  $$typeof: REACT_LAZY_TYPE,
  _payload: payload,
  _init: lazy_initializer,
}
```

这里值得关注的是 `lazy_initializer` 这个方法，还是用 JS 版本的来说明：

```js
function lazy_initializer(payload) {
  if (payload._status === Uninitialized) {
    const ctor = payload._result
    const thenable = ctor()
    thenable.then(
      (moduleObject) => {
        payload._status = Resolved
        payload._result = moduleObject
      },
      (error) => {
        payload._status = Rejected
        payload._result = error
      }
    )

    payload._status = Pending
    payload._result = thenable
  }

  if (payload._status === Resolved) {
    const moduleObject = payload._result
    return moduleObject.default
  } else {
    throw payload._result
  }
}
```

这个跟上篇文章实现的 use hook 有点类似，这里的 `ctor` 就是上面例子的 `() => import('./Cpn').then((res) => delay(res))`，执行它返回的是一个 Promise 对象。只有当对象状态为 `Resolved` 才会返回它的结果，即 `res`，这里的 `res` 是一个模块对象，它的属性 `default` 是模块中通过 `export default` 导出的内容。其他状态则直接抛出 `_result`，当状态为 `Pending` 时，`_result` 是 Promsie 对象本身，当状态为 `Rejected` 时，`_result` 是错误对象。

接着，主要需要修改的文件为 `begin_work.rs`：

```rust
....
        WorkTag::LazyComponent => update_lazy_component(work_in_progress.clone(), render_lane),
    };
}

fn update_lazy_component(
    work_in_progress: Rc<RefCell<FiberNode>>,
    render_lane: Lane,
) -> Result<Option<Rc<RefCell<FiberNode>>>, JsValue> {
    let lazy_type = { work_in_progress.borrow()._type.clone() };
    let payload = derive_from_js_value(&lazy_type, "_payload");
    let init_jsvalue = derive_from_js_value(&lazy_type, "_init");
    let init = init_jsvalue.dyn_ref::<Function>().unwrap();
    // return value OR throw
    let Component = init.call1(&JsValue::null(), &payload)?;
    work_in_progress.borrow_mut()._type = Component.clone();
    work_in_progress.borrow_mut().tag = WorkTag::FunctionComponent;
    let child = update_function_component(work_in_progress, Component.clone(), render_lane);
    child
}
....
```

这里的关键在这一行 `let Component = init.call1(&JsValue::null(), &payload)?;`，执行 `init` 如果抛出了异常，根据上一篇文章的流程，会往上找到最近的 `Suspense` 再次开始 render 流程，此时会渲染 Suspense 的 fallback。等到 Promise 对象 resolve 时，会重新出发更新流程，再次到这里的时候执行 `init` 返回的就是模块导出的组件了，即 `Cpn`。

此外，还需要修改 `work_loop.rs` 中的 `handle_throw`，在 `else` 中补充非 `use` 抛出错误的场景：

```rust
fn handle_throw(root: Rc<RefCell<FiberRootNode>>, mut thrown_value: JsValue) {
    /*
        throw possibilities:
            1. use thenable
            2. error (Error Boundary)，lazy
    */
    if Object::is(&thrown_value, &SUSPENSE_EXCEPTION) {
        unsafe { WORK_IN_PROGRESS_SUSPENDED_REASON = SUSPENDED_ON_DATA };
        thrown_value = get_suspense_thenable();
    } else {
        let is_wakeable = !thrown_value.is_null()
            && type_of(&thrown_value, "object")
            && derive_from_js_value(&thrown_value, "then").is_function();
        unsafe {
            WORK_IN_PROGRESS_SUSPENDED_REASON = if is_wakeable {
                SUSPENDED_ON_DEPRECATED_THROW_PROMISE
            } else {
                SUSPENDED_ON_ERROR
            };
        };
    }

    unsafe {
        WORK_IN_PROGRESS_THROWN_VALUE = Some(thrown_value);
    }
}
```

最后，上一篇文章还留了一个尾巴，即 bailout 影响了 Suspense 的正常工作，最后的解决办法是首先把冒泡更新优先级的代码移到了 `fiber_throw.rs` 中：

```rust
let closure = Closure::wrap(Box::new(move || {
  ...
  mark_update_lane_from_fiber_to_root(source_fiber.clone(), lane.clone());
  ensure_root_is_scheduled(root.clone());
}) as Box<dyn Fn()>);
...
```

同时，在 `begin_work.rs` 中将 Suspense 组件排除在 bailout 逻辑之外：

```rust
if !has_scheduled_update_or_context
    && current.borrow().tag != WorkTag::SuspenseComponent
{
  ...
  return Ok(bailout_on_already_finished_work(
      work_in_progress,
      render_lane,
  ));
}
```
