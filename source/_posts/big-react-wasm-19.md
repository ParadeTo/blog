---
title: 从零实现 React v18，但 WASM 版 - [19] 性能优化之 bailout 和 eagerState
date: 2024-07-19 19:54:25
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
> 本文对应 tag：[v19](https://github.com/ParadeTo/big-react-wasm/tree/v19)

> Based on [big-react](https://github.com/BetaSu/big-react)，I am going to implement React v18 core features from scratch using WASM and Rust.
>
> Code Repository：https://github.com/ParadeTo/big-react-wasm
>
> The tag related to this article：[v19](https://github.com/ParadeTo/big-react-wasm/tree/v19)

React 中有两种优化策略，分别叫做 bailout 和 eagerState。所谓 bailout，就是在更新过程中，当满足某些条件时，跳过当前 FiberNode 或其子孙节点，或者两者兼有的 reconciler 过程。而 eagerState 则是在更新 state 时，若满足某些条件，直接不触发更新。下面，我们通过一个例子来说明（react 版本为 18.2.0）：

In React, there are two optimization strategies called "bailout" and "eagerState." Bailout refers to skipping the current FiberNode or its descendant nodes, or both, during the reconciliation process when certain conditions are met. On the other hand, eagerState allows skipping the update directly when updating the state if certain conditions are met. Below, we will provide an example to illustrate these strategies (React version 18.2.0):

```js
function Child({num}) {
  console.log('Child render')
  return <div>Child {num}</div>
}

function Parent() {
  console.log('Parent render')
  const [num, setNum] = useState(1)
  return (
    <div onClick={() => setNum(2)}>
      Parent {num}
      <Child num={num} />
    </div>
  )
}

export default function App() {
  console.log('App render')
  return (
    <div>
      App
      <Parent />
    </div>
  )
}
```

1 首次渲染，控制台打印输出：

```
App render
Parent render
Child render
```

2 第一次点击，控制台打印输出：

```
Parent render
Child render
```

3 第二次点击，控制台打印输出：

```
Parent render
```

4 第三次点击，控制台没有任何输出

我们来简单分析下：

- 首次渲染，都打印，这个自然不用多说。

- 第一次点击时，App 组件即没有 props 的变化，又没有触发更新任务，不打印 App render 是合理的。Parent 触发了更新 (1->2)，打印 Parent render，合理。Child 的 props 发生变化，打印 Child render，也合理。

- 第二次点击时，Parent 虽然触发了更新，但是前后 state 并没有发生变化，貌似不应该打印 Parent render，此为第一个疑点。而且既然 Parent 组件重新执行了，那意外着 Parent 组件下的 ReactElement 也都重新创建了一遍，那 Child 的新旧 props 应该是不同的，那为什么 Child render 没打印？此为第二个疑点。

- 第三次点击时，Parent 虽然触发了更新，但是前后 state 并没有发生变化，不应该 Parent render，也不打印 Child render，合理。

对于疑点一，其实这反映了 react 的优化做得还不够彻底，详情请见[这篇文章](https://mp.weixin.qq.com/s/zbDW3pBj-w9m59o_4SIfZA)。

对于疑点二，下面会说明。

接下来我们来简单介绍下，如何实现这两个优化，本次改动详见[这里](https://github.com/ParadeTo/big-react-wasm/pull/19/files)。

1. First render, console output:

```
App render
Parent render
Child render
```

2. First click, console output:

```
Parent render
Child render
```

3. Second click, console output:

```
Parent render
```

4. Third click, no console output.

Let's analyze this briefly:

- During the first render, all components are printed, which is expected.

- During the first click, the App component doesn't have any prop changes and doesn't trigger an update task, so it's reasonable that "App render" is not printed. The Parent component triggers an update (1->2), so "Parent render" is printed, which is expected. The Child component has prop changes, so "Child render" is printed, which is also expected.

- During the second click, although the Parent component triggers an update, the state remains the same. It seems that "Parent render" shouldn't be printed, which is the first question. Also, since the Parent component is re-executed, it implies that the ReactElements under the Parent component are also recreated, so the new and old props of the Child component should be different. Why isn't "Child render" printed? This is the second question.

- During the third click, although the Parent component triggers an update, the state remains the same. "Parent render" shouldn't be printed, and "Child render" shouldn't be printed either, which is reasonable.

Regarding the first question, it actually reflects that React's optimization is not thorough enough. For more details, please refer to [this article](https://mp.weixin.qq.com/s/zbDW3pBj-w9m59o_4SIfZA) (article in Chinese).

Regarding the second question, it will be explained below.

Next, let's briefly introduce how to implement these two optimizations. The specific changes can be found [here](https://github.com/ParadeTo/big-react-wasm/pull/19/files).

# bailout

实现之前，我们先来想想，一个 FiberNode 什么时候可以跳过 reconciler 流程呢？仔细思考下，应该需要满足以下几种情况：

- 这个节点的 `props` 且 `type` 没变
- 这个节点上面的更新优先级小于此次更新优先级
- 没有使用 `Context`
- 开发者没有使用 `shouldComponentUpdate` 或 `React.memo` 来进行跳过

由于我们的 big react wasm 还没有实现后两者，所以接下来我们暂时只讨论前面两种情况。

我们需要在 `begin_work` 的最前面加入 bailout 的逻辑，代码如下：

Before we proceed with the implementation, let's think about when a FiberNode can skip the reconciliation process. Upon careful consideration, it should meet the following conditions:

- The `props` and `type` of the node haven't changed.
- The update priority of the node is lower than the current update priority.
- There is no use of `Context`.
- The developer hasn't used `shouldComponentUpdate` or `React.memo` to skip updates.

Since our "big react wasm" implementation hasn't included the last two conditions, we will only discuss the first two conditions for now.

We need to add the bailout logic at the beginning of the `begin_work` function. The code is as follows:

```rust
...
unsafe {
    DID_RECEIVE_UPDATE = false;
};
let current = work_in_progress.borrow().alternate.clone();

if current.is_some() {
    let current = current.unwrap();
    let old_props = current.borrow().memoized_props.clone();
    let old_type = current.borrow()._type.clone();
    let new_props = work_in_progress.borrow().pending_props.clone();
    let new_type = work_in_progress.borrow()._type.clone();
    // Condition 1
    if !Object::is(&old_props, &new_props) || !Object::is(&old_type, &new_type) {
        unsafe { DID_RECEIVE_UPDATE = true }
    } else {
        // Condition 2
        let has_scheduled_update_or_context =
            check_scheduled_update_or_context(current.clone(), render_lane.clone());

        if !has_scheduled_update_or_context {
            unsafe { DID_RECEIVE_UPDATE = false }
            return Ok(bailout_on_already_finished_work(
                work_in_progress,
                render_lane,
            ));
        }
    }
}

work_in_progress.borrow_mut().lanes = Lane::NoLane;
...
```

```rust
fn check_scheduled_update_or_context(current: Rc<RefCell<FiberNode>>, render_lane: Lane) -> bool {
    let update_lanes = current.borrow().lanes.clone();
    if include_some_lanes(update_lanes, render_lane) {
        return true;
    }
    // TODO Context
    false
}
```

并且，当这个 FiberNode 命中 bailout 策略时，如果子节点中也没有满足此次更新的优先级的节点，则以当前 FiberNode 为根的整颗子树也可以跳过：

And when this FiberNode hits the bailout strategy, if none of the child nodes meet the update priority for this update, the entire subtree rooted at the current FiberNode can also be skipped.

```rust
fn bailout_on_already_finished_work(
    wip: Rc<RefCell<FiberNode>>,
    render_lane: Lane,
) -> Option<Rc<RefCell<FiberNode>>> {

    if !include_some_lanes(wip.borrow().child_lanes.clone(), render_lane) {
        if is_dev() {
            log!("bailout the whole subtree {:?}", wip);
        }
        return None;
    }
    if is_dev() {
        log!("bailout current fiber {:?}", wip);
    }
    clone_child_fiblers(wip.clone());
    wip.borrow().child.clone()
}
```

这里的 `child_lanes` 是某个 FiberNode 节点的所有子孙节点的 `lanes` 的合集，如下所示：

The `child_lanes` here represent the combined `lanes` of all the descendant nodes of a FiberNode, as shown below:

![](./big-react-wasm-19/1.png)

当某个节点触发更新时，会一路向上冒泡更新其祖先的 `child_lanes`。

前面说过了，bailout 策略有三种场景：跳过当前 FiberNode，跳过当前 FiberNode 及其子孙节点，跳过子孙节点。这里已经介绍了跳过当前 FiberNode 和跳过当前 FiberNode 及其子孙节点两种场景，那么第三种情况什么时候会发生呢？其实这也是上文说的第二个疑点的答案。答案就在 `update_function_component`：

When a node triggers an update, it bubbles up to update the `child_lanes` of its ancestors.

As mentioned earlier, the bailout strategy has three scenarios: skipping the current FiberNode, skipping the current FiberNode and its descendants, and skipping only the descendants. We have already discussed the first two scenarios, so when does the third scenario occur? The answer lies in the `update_function_component`:

```rust
fn update_function_component(
    work_in_progress: Rc<RefCell<FiberNode>>,
    render_lane: Lane,
) -> Result<Option<Rc<RefCell<FiberNode>>>, JsValue> {
    let next_children = render_with_hooks(work_in_progress.clone(), render_lane.clone())?;

    let current = work_in_progress.borrow().alternate.clone();
    if current.is_some() && unsafe { !DID_RECEIVE_UPDATE } {
        bailout_hook(work_in_progress.clone(), render_lane.clone());
        return Ok(bailout_on_already_finished_work(
            work_in_progress,
            render_lane,
        ));
    }

    reconcile_children(work_in_progress.clone(), Some(next_children));
    Ok(work_in_progress.clone().borrow().child.clone())
}
```

这里会先去执行一次当前 FiberNode 节点对应的组件代码，只有发现某个 state 更新前后的值不一样，才会将 `DID_RECEIVE_UPDATE` 设为 `true`：

Here, the component code corresponding to the current FiberNode is executed once. Only if it detects a difference between the previous and current values of a state, it sets `DID_RECEIVE_UPDATE` to `true`:

```rust
// filber_hooks.rs
...
if !Object::is(&ms_value, &ps_value) {
    mark_wip_received_update();
}
...
```

```rust
// begin_work.rs
static mut DID_RECEIVE_UPDATE: bool = false;

pub fn mark_wip_received_update() {
    unsafe { DID_RECEIVE_UPDATE = true };
}

```

那如果都一样，则可以进入 `bailout_on_already_finished_work` 的逻辑了。

这样就解释了疑点二，虽然 Parent 意外的重新 Render 了，但是通过这一层额外的保障，不至于让影响面扩大。

If the values are the same, it can proceed to the logic of `bailout_on_already_finished_work`.

This explains the second question. Although the Parent component was unexpectedly re-rendered, this additional safeguard prevents the impact from spreading further.

# eagerState

eagerState 实现起来相对简单一点，当在 `dispatch_set_state` 时，如果 WIP 和 Current 上的更新优先级都为 NoLane，以及更新前后 state 的值相等，则可以直接不触发更新：

The implementation of eagerState is relatively straightforward. When `dispatch_set_state` is called, if both the WIP and Current have a priority of NoLane and the state values before and after the update are equal, the update can be skipped directly:

```rust
fn dispatch_set_state(
    fiber: Rc<RefCell<FiberNode>>,
    update_queue: Rc<RefCell<UpdateQueue>>,
    action: &JsValue,
) {
    let lane = request_update_lane();
    let mut update = create_update(action.clone(), lane.clone());
    let current = { fiber.borrow().alternate.clone() };

    if fiber.borrow().lanes == Lane::NoLane
        && (current.is_none() || current.unwrap().borrow().lanes == Lane::NoLane)
    {
        let current_state = update_queue.borrow().last_rendered_state.clone();
        if current_state.is_none() {
            panic!("current state is none")
        }
        let current_state = current_state.unwrap();
        let eager_state = basic_state_reducer(&current_state, &action);
        // if not ok, the update will be handled in render phase, means the error will be handled in render phase
        if eager_state.is_ok() {
            let eager_state = eager_state.unwrap();
            update.has_eager_state = true;
            update.eager_state = Some(eager_state.clone());
            if Object::is(&current_state, &eager_state) {
                enqueue_update(update_queue.clone(), update, fiber.clone(), Lane::NoLane);
                if is_dev() {
                    log!("Hit eager state")
                }
                return;
            }
        }
    }
    ...
}
```

[这篇文章](https://mp.weixin.qq.com/s/zbDW3pBj-w9m59o_4SIfZA) 总结了 react 优化没有优化彻底的原因是因为 react 中存在两棵 FiberNode 树，点击时只清除了某一棵树上的“更新标记”，所以需要多执行一次才能保证两棵树上的“更新标记”都清除了。所以如果多加一句代码到这，就可以达到彻底优化的效果了：

[This article](https://mp.weixin.qq.com/s/zbDW3pBj-w9m59o_4SIfZA) concludes that the reason React optimization is not thorough is because there are two FiberNode trees in React. When a click occurs, only the "update flags" on one tree are cleared, so an additional execution is needed to ensure that the "update flags" on both trees are cleared. Therefore, if an additional line of code is added here, it can achieve thorough optimization.

```rust
pub fn begin_work(
    work_in_progress: Rc<RefCell<FiberNode>>,
    render_lane: Lane,
) -> Result<Option<Rc<RefCell<FiberNode>>>, JsValue> {
...
work_in_progress.borrow_mut().lanes = Lane::NoLane;
+ if current.is_some() {
+     let current = current.clone().unwrap();
+     current.borrow_mut().lanes = Lane::NoLane;
+ }
...
}
```
