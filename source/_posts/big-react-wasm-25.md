---
title: 从零实现 React v18，但 WASM 版 - [25] 实现 Suspense（二）：结合 use hooks 获取数据
date: 2024-09-06 15:45:14
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
> 本文对应 tag：[v25](https://github.com/ParadeTo/big-react-wasm/tree/v25)

在 React 新版本中，`Suspense` 一个非常大的作用就是结合 `use` 来获取数据，今天我们来实现一下，本次改动见[这里](https://github.com/ParadeTo/big-react-wasm/pull/27)。

我们用这个例子来解释一下本次改动：

```js
import {Suspense, use} from 'react'

const delay = (t) =>
  new Promise((resolve, reject) => {
    setTimeout(reject, t)
  })

const cachePool = []

function fetchData(id, timeout) {
  const cache = cachePool[id]
  if (cache) {
    return cache
  }
  return (cachePool[id] = delay(timeout).then(() => {
    return {data: Math.random().toFixed(2) * 100}
  }))
}

export default function App() {
  return (
    <Suspense fallback={<div>loading</div>}>
      <Child />
    </Suspense>
  )
}

function Child() {
  const {data} = use(fetchData(1, 1000))
  return <span>{data}</span>
}
```

我们先按照之前新增 hooks 的流程把相关代码都加上，最后会来到 `fiber_hooks.rs`：

```rs
fn _use(usable: JsValue) -> Result<JsValue, JsValue> {
  if !usable.is_null() && type_of(&usable, "object") {
      if derive_from_js_value(&usable, "then").is_function() {
          return track_used_thenable(usable);
      } else if derive_from_js_value(&usable, "$$typeof") == REACT_CONTEXT_TYPE {
          return Ok(read_context(usable));
      }
  }
  Err(JsValue::from_str("Not supported use arguments"))
}
```

从代码可以看到 `use` 这个函数即可传入一个 `Promise` 对象，也可传入一个 `Context` 对象，这里暂时只讨论 `Promise` 对象，所以我们看看 `track_used_thenable`：

```rs
#[wasm_bindgen]
extern "C" {
    pub static SUSPENSE_EXCEPTION: JsValue;
}

pub fn track_used_thenable(thenable: JsValue) -> Result<JsValue, JsValue> {
    ...
    unsafe { SUSPENDED_THENABLE = Some(thenable.clone()) };
    Err(SUSPENSE_EXCEPTION.__inner.with(JsValue::clone))
}
```

中间的部分先略过，最后会返回一个 `Result` 的变体 `Err`，里面的 payload 为 `SUSPENSE_EXCEPTION`，这个 `SUSPENSE_EXCEPTION` 会在构建的时候插入到结果之中：

```js
const SUSPENSE_EXCEPTION = new Error(
  "It's not a true mistake, but part of Suspense's job. If you catch the error, keep throwing it out"
)
```

这里不直接返回 `thenable` 而是返回 `SUSPENSE_EXCEPTION` 是为了后续好区分用户代码抛出的异常和 react 自己的异常，我们真正关心的值存在 `SUSPENDED_THENABLE` 里面。

之后，会来到 `work_loop.rs` 这里：

```rs
loop {
    ...
    match if should_time_slice {
        work_loop_concurrent()
    } else {
        work_loop_sync()
    } {
        Ok(_) => {
            break;
        }
        Err(e) => handle_throw(root.clone(), e),
    };
}
```

这个 `e` 就是前面所说的 `SUSPENSE_EXCEPTION`，来看看 `handle_throw` 是怎么处理的：

```rs
fn handle_throw(root: Rc<RefCell<FiberRootNode>>, mut thrown_value: JsValue) {
    /*
        throw possibilities:
            1. use thenable
            2. error (Error Boundary)
    */
    if Object::is(&thrown_value, &SUSPENSE_EXCEPTION) {
        unsafe { WORK_IN_PROGRESS_SUSPENDED_REASON = SUSPENDED_ON_DATA };
        thrown_value = get_suspense_thenable();
    } else {
        // TODO
    }

    unsafe {
        WORK_IN_PROGRESS_THROWN_VALUE = Some(thrown_value);
    }
}
```

这里会判断异常是不是 `SUSPENSE_EXCEPTION`，如果是的，就把真正的值重新拿出来，这就跟前面说的对上了。

这个值最后会传给 `throw_and_unwind_work_loop`：

```rs
    loop {
        unsafe {
            if WORK_IN_PROGRESS_SUSPENDED_REASON != NOT_SUSPENDED && WORK_IN_PROGRESS.is_some() {
                let thrown_value = WORK_IN_PROGRESS_THROWN_VALUE.clone().unwrap();

                WORK_IN_PROGRESS_SUSPENDED_REASON = NOT_SUSPENDED;
                WORK_IN_PROGRESS_THROWN_VALUE = None;

                // TODO
                mark_update_lane_from_fiber_to_root(
                    WORK_IN_PROGRESS.clone().unwrap(),
                    lane.clone(),
                );

                throw_and_unwind_work_loop(
                    root.clone(),
                    WORK_IN_PROGRESS.clone().unwrap(),
                    thrown_value,
                    lane.clone(),
                );
            }
        }
        ...
    }
```

这个我们上篇文章已经介绍过了，这里就不啰嗦了。我们再回到 `track_used_thenable`：

```rs
pub fn track_used_thenable(thenable: JsValue) -> Result<JsValue, JsValue> {
    let status = derive_from_js_value(&thenable, "status");
    if status.is_string() {
      ...
    } else {
        Reflect::set(&thenable, &"status".into(), &"pending".into());
        let v = derive_from_js_value(&thenable, "then");
        let then = v.dyn_ref::<Function>().unwrap();

        let thenable1 = thenable.clone();
        let on_resolve_closure = Closure::wrap(Box::new(move |val: JsValue| {
            if derive_from_js_value(&thenable1, "status") == "pending" {
                Reflect::set(&thenable1, &"status".into(), &"fulfilled".into());
                Reflect::set(&thenable1, &"value".into(), &val);
            }
        }) as Box<dyn Fn(JsValue) -> ()>);
        let on_resolve = on_resolve_closure
            .as_ref()
            .unchecked_ref::<Function>()
            .clone();
        on_resolve_closure.forget();

        let thenable2 = thenable.clone();
        let on_reject_closure = Closure::wrap(Box::new(move |err: JsValue| {
            if derive_from_js_value(&thenable2, "status") == "pending" {
                Reflect::set(&thenable2, &"status".into(), &"rejected".into());
                Reflect::set(&thenable2, &"reason".into(), &err);
            }
        }) as Box<dyn Fn(JsValue) -> ()>);
        let on_reject = on_reject_closure
            .as_ref()
            .unchecked_ref::<Function>()
            .clone();
        on_reject_closure.forget();

        then.call2(&thenable, &on_resolve, &on_reject);
    }
}
```

这里首次进来会走 `else`，核心逻辑就是给 `thenable` 添加 `on_resolve` 和 `on_reject` 方法，修改它上面的 `status`，`value` 和 `reason` 属性。

等到 `Promise` 对象的状态不再是 `pending` 后，会触发重新渲染，当再次来到这个函数时，它的 `status` 上也有值了，此时会进入 `if`：

```rs
if status.is_string() {
  if status == "fulfilled" {
      return Ok(derive_from_js_value(&thenable, "value"));
  } else if status == "rejected" {
      return Err(derive_from_js_value(&thenable, "reason"));
  }
  ...
}
```

如果其状态为 `filfilled`，就返回 `value` 的值，否则抛出 `reason` 上的异常。

`Suspense` 结合 `use` hook 获取数据的实现就介绍到这，不过调试发现 bailout 的逻辑会影响该流程的正常工作，所以目前只能暂时注释掉这一部分的代码，后面有时间再来看看如何解决。
