---
title: 从零实现 React v18，但 WASM 版 - [22] 实现 memo
date: 2024-08-01 09:55:54
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
> 本文对应 tag：[v22](https://github.com/ParadeTo/big-react-wasm/tree/v22)

前面几篇文章都是围绕 React 性能优化相关的特性展开的，不过还差一个 memo，今天就来实现一下。以下面代码为例：

```js
import {useState, memo} from 'react'

export default function App() {
  const [num, update] = useState(0)
  console.log('App render', num)
  return (
    <div onClick={() => update(num + 1)}>
      <Cpn num={num} name={'cpn1'} />
      <Cpn num={0} name={'cpn2'} />
    </div>
  )
}

const Cpn = memo(function ({num, name}) {
  console.log('render', name)
  return (
    <div>
      {name}: {num}
      <Child />
    </div>
  )
})

function Child() {
  console.log('Child render')
  return <p>i am child</p>
}
```

首次渲染时，会打印：

```
App render 0
render cpn1
Child render
render cpn2
Child render
```

点击后，应该只有第一个 Cpn 组件会重新渲染，控制台打印：

```
App render 1
render cpn1
Child render
```

下面我们来看看要怎么实现。

首先，需要从 react 这个库中导出 `memo` 方法，如下所示：

```rust
#[wasm_bindgen]
pub unsafe fn memo(_type: &JsValue, compare: &JsValue) -> JsValue {
    let fiber_type = Object::new();

    Reflect::set(
        &fiber_type,
        &"$$typeof".into(),
        &JsValue::from_str(REACT_MEMO_TYPE),
    );
    Reflect::set(&fiber_type, &"type".into(), _type);

    let null = JsValue::null();
    Reflect::set(
        &fiber_type,
        &"compare".into(),
        if compare.is_undefined() {
            &null
        } else {
            compare
        },
    );
    fiber_type.into()
}
```

翻译成 JS 的话，是这样：

```rust
export function memo(
	type: FiberNode['type'],
	compare?: (oldProps: Props, newProps: Props) => boolean
) {
	const fiberType = {
		$$typeof: REACT_MEMO_TYPE,
		type,
		compare: compare === undefined ? null : compare
	};
	return fiberType;
}
```

跟之前的 context Provider 类似，这里也是返回了一个对象，并且把传入的组件保存在了 `type` 字段中，同时把第二个参数存在了 `compare` 字段中，该字段的作用应该都清楚，就不赘述了。很明显，这里又是一个新的 `FiberNode` 类型，我们需要在 begin work 中增加对该类型的处理：

```rust

fn update_memo_component(
    work_in_progress: Rc<RefCell<FiberNode>>,
    render_lane: Lane,
) -> Result<Option<Rc<RefCell<FiberNode>>>, JsValue> {
    let current = { work_in_progress.borrow().alternate.clone() };
    let next_props = { work_in_progress.borrow().pending_props.clone() };

    if current.is_some() {
        let current = current.unwrap();
        let prev_props = current.borrow().memoized_props.clone();
        if !check_scheduled_update_or_context(current.clone(), render_lane.clone()) {
            let mut props_equal = false;
            let compare = derive_from_js_value(&work_in_progress.borrow()._type, "compare");
            if compare.is_function() {
                let f = compare.dyn_ref::<Function>().unwrap();
                props_equal = f
                    .call2(&JsValue::null(), &prev_props, &next_props)
                    .unwrap()
                    .as_bool()
                    .unwrap();
            } else {
                props_equal = shallow_equal(&prev_props, &next_props);
            }

            if props_equal && Object::is(&current.borrow()._ref, &work_in_progress.borrow()._ref) {
                unsafe { DID_RECEIVE_UPDATE = false };
                work_in_progress.borrow_mut().pending_props = prev_props;
                work_in_progress.borrow_mut().lanes = current.borrow().lanes.clone();
                return Ok(bailout_on_already_finished_work(
                    work_in_progress.clone(),
                    render_lane,
                ));
            }
        }
    }
    let Component = { derive_from_js_value(&work_in_progress.borrow()._type, "type") };
    update_function_component(work_in_progress.clone(), Component, render_lane)
}
```

这里的代码很好懂，如果有 `current`，说明不是首次渲染，可以看是否可以进行性能优化。

首先还是通过 `check_scheduled_update_or_context` 判断子孙组件中是否有满足这次更新优先级的节点，如果没有则进行 memo 相关的性能优化，具体来说为：

- 获取 `compare` 函数，如果没有则用默认的 `shallow_equal`（该函数用于对比两个对象是否相等，key 相同且其值相同时两个对象相等，值的比较为浅比较）
- 将新旧 `props` 传入上面得到的函数
- 如果 `compare` 返回 true，则进入 `bailout` 逻辑

否则，进入 `update_function_component` 逻辑，因为 memo 只是在 `FunctionComponent` 外面多套了一层而已。注意到这里的 `update_function_component` 的参数跟之前不一样了，之前只有 `work_in_progress` 和 `render_lane` 是因为只考虑 `FunctionComponent` 的情况下，可以从 `work_in_progress` 的 `_type` 中获取 `Component`，现在加入了 `MemoComponent`，则需要从 `work_in_progress` 的 `_type` 中的 `type` 来获取 `Component`。

其他比较细微的改动就不介绍了，详情请见[这里](https://github.com/ParadeTo/big-react-wasm/pull/22)。
