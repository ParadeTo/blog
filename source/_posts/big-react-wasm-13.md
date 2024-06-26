---
title: 从零实现 React v18，但 WASM 版 - [13] 引入 Lane 模型，实现 Batch Update
date: 2024-05-11 09:17:13
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
> 本文对应 tag：[v13](https://github.com/ParadeTo/big-react-wasm/tree/v13)

> Based on [big-react](https://github.com/BetaSu/big-react)，I am going to implement React v18 core features from scratch using WASM and Rust.
>
> Code Repository：https://github.com/ParadeTo/big-react-wasm
>
> The tag related to this article：[v13](https://github.com/ParadeTo/big-react-wasm/tree/v13)

我们知道，React 从 v17 开始使用 Lane 模型来替代之前的 Expiration Time 。为什么会有这种变化呢？我们先来看看之前的 Expiration Time 模型是怎么工作的。

We know that starting from v17, React has been using the Lane model to replace the previous Expiration Time model. Why was this change made? Let's first take a look at how the former Expiration Time model worked.

每次触发更新，会产生一个 `update` 的数据结构，该结构上有个 `expirationTime` 的字段用来表示优先级。顾名思义，`expirationTimes` 是过期时间的意思，按照我们的惯例这个值越小表示越快过期，优先级应该越高。但它的值并不是简单的用当前时间加上一个常数得到的，而是经过了一系列的算法，最终的效果就是值越大优先级越高。一个 Fiber Tree 的 `FiberNode` 可能存在多个 `update`。

Each time an update is triggered, an `update` data structure is created, which has an `expirationTime` field to represent its priority. As the name implies, `expirationTimes` means the time after which the update is considered stale. According to our convention, the smaller the value, the sooner it expires, and the higher the priority should be. However, its value is not simply determined by adding a constant to the current time; it is the result of a series of algorithms, which ultimately mean that a larger value indicates a higher priority. A Fiber Tree's `FiberNode` may have multiple `updates`.

每次 React 调度更新时，会在所有 `FiberNode` 节点的所有 `update.expirationTime` 中选择一个 `expirationTime` 作为本次更新的 `renderExpirationTime`，如果 `FiberNode` 中的 `update.expirationTime` < `renderExpirationTime`，则该 `update` 会被跳过：

Every time React schedules an update, it selects an `expirationTime` from all the `update.expirationTimes` in all the `FiberNode` nodes to be the `renderExpirationTime` for this update. If the `update.expirationTime` in a `FiberNode` is less than the `renderExpirationTime`, then that `update` will be skipped:

```js
// https://github.com/facebook/react/blob/v16.10.0/packages/react-reconciler/src/ReactUpdateQueue.js#L516-L518
const updateExpirationTime = update.expirationTime;
    if (updateExpirationTime < renderExpirationTime) {
      // This update does not have sufficient priority. Skip it.
```

可以看到，使用 Expiration Time 这种模型时，如果想要判断当前更新任务是否包含在某个更新批次中，我们可以这样比较他们的优先级：

It can be seen that when using the Expiration Time model, if we want to determine whether a current update task is included in a certain batch of updates, we can compare their priorities like this:

```js
const isTaskIncludedInBatch = priorityOfTask >= priorityOfBatch
```

这种方式的结果就是低优先级的任务不能单独拧出来处理。比如给定优先级 A > B > C，你不能在不处理 A 的情况下处理 B；同样，你不能在不同时处理 B 和 A 的情况下处理 C。

The result of this method is that tasks with lower priority cannot be processed individually. For example, given priorities A > B > C, you cannot process B without handling A; similarly, you cannot handle C without also handling B and A at the same time.

在 `Suspense` 出现之前，这样做是合理的。但是，当你引入了 IO 任务（即 Suspense），你可能会遇到一个情况，即一个高优先级的 IO 任务阻止了一个低优先级的 CPU 任务，但实际情况我们期望低优先级的 CPU 任务先完成。

Before the introduction of `Suspense`, this was reasonable. However, when you introduce IO tasks (i.e., Suspense), you might encounter a situation where a high-priority IO task prevents a low-priority CPU task from executing, while in reality, we would prefer the low-priority CPU task to complete first.

考虑如下代码：

Consider the following code:

```js
const App = () => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setCount((count) => count + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <Suspense fallback={<div>loading...</div>}>
        <Comp />
      </Suspense>
      <div>count is {count}</div>
    </>
  )
}
```

其中：

- `Comp` 中会发起异步请求（假设 2 秒后才返回），请求返回前会一直显示 loading
- 每隔 1 秒将 count 加一

则看到的效果应该是这样：

Within this scenario:

- `Comp` initiates an asynchronous request (assuming it takes 2 seconds to return), and it will continuously show loading until the request returns.
- The count is incremented by one every second.

The observed effect should be as follows:

```html
<div>loading...</div>
<div>count is 0</div>
=>
<div>loading...</div>
<div>count is 1</div>
=>
<div>loading...</div>
<div>count is 2</div>
=>
<div>I am comp, request successfully</div>
<div>count is 3</div>
```

但是如果按照 Expiration Time 模型的规则，由于 `Suspense` 对应的高优 IO 更新会阻止低优先级的 CPU 更新，所以看到的内容会是下面这样：

However, if we follow the rules of the Expiration Time model, since the high-priority IO update corresponding to `Suspense` will block the low-priority CPU update, the content observed would be as follows:

```html
<div>loading...</div>
<div>count is 0</div>
=>
<div>loading...</div>
<div>count is 0</div>
=>
<div>loading...</div>
<div>count is 0</div>
=>
<div>I am comp, request successfully</div>
<div>count is 3</div>
```

Expiration Time 的另一个缺陷是在表示多个优先级组的方式上受到限制。使用 `Set` 的话在内存或计算上都不实际，因为要处理的计算非常普遍，所以需要尽可能快速并且使用尽可能少的内存。

作为妥协，我们通常会做的是维护一个优先级范围：

Another flaw of the Expiration Time model is its limitation in representing multiple groups of priorities. Using a `Set` is impractical both in terms of memory and computation, because the calculations to be handled are very common, so they need to be as fast as possible and use as little memory as possible.

As a compromise, what we would typically do is maintain a range of priorities:

```js
const isTaskIncludedInBatch =
  taskPriority <= highestPriorityInRange &&
  taskPriority >= lowestPriorityInRange
```

如果是多个不连续的范围那代码写起来就比较繁琐了。

而换成 Lane 模型的话，计算起来就变得非常简单了：

If there are multiple discontinuous ranges, then the code becomes quite cumbersome to write.

However, with the Lane model, the calculation becomes very simple:

```js
const isTaskIncludedInBatch = (task & batchOfTasks) !== 0
```

简单介绍了下 Lane 模型，接下来看具体怎么实现。

这次的目标是实现 Batch Update，比如下面的例子，多次更新只会触发一次渲染：

Having briefly introduced the Lane model, let's look at how it is implemented specifically.

The goal this time is to implement Batch Update, where, as in the following example, multiple updates will only trigger a single render:

```js
function App() {
  const [num, updateNum] = useState(0)

  return (
    <ul
      onClick={(e) => {
        updateNum((num: number) => num + 1)
        updateNum((num: number) => num + 2)
        updateNum((num: number) => num + 3)
        updateNum((num: number) => num + 4)
      }}>
      num值为：{num}
    </ul>
  )
}
```

首先，我们定义好 Lane 以及相关的处理函数，目前只有两种 Lane:

Firstly, we define the Lanes and the related handling functions; currently, there are only two types of Lanes:

```rust
use bitflags::bitflags;

bitflags! {
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct Lane: u8 {
        const NoLane = 0b0000000000000000000000000000000;
        const SyncLane = 0b0000000000000000000000000000001;
    }
}

pub fn get_highest_priority(lanes: Lane) -> Lane {
    let lanes = lanes.bits();
    let highest_priority = lanes & (lanes.wrapping_neg());
    Lane::from_bits_truncate(highest_priority)
}

pub fn merge_lanes(lane_a: Lane, lane_b: Lane) -> Lane {
    lane_a | lane_b
}

pub fn request_update_lane() -> Lane {
    Lane::SyncLane
}
```

每当在 `FiberNode` 上触发更新时，会将更新的 Lane 冒泡到根节点 `root`，并同 `root.pendingLanes` 进行合并：

Whenever an update is triggered on a `FiberNode`, the update's Lane is bubbled up to the root node `root` and merged with `root.pendingLanes`:

```rust
pub fn mark_root_updated(&mut self, lane: Lane) {
    self.pending_lanes = merge_lanes(self.pending_lanes.clone(), lane)
}
```

然后，根节点选出优先级最高的 Lane，并开启一轮渲染流程：

Subsequently, the root node selects the highest priority Lane and begins a round of the rendering process:

```rust
fn ensure_root_is_scheduled(root: Rc<RefCell<FiberRootNode>>) {
    let root_cloned = root.clone();
    let update_lane = get_highest_priority(root.borrow().pending_lanes.clone());
    if update_lane == Lane::NoLane {
        return;
    }
    schedule_sync_callback(Box::new(move || {
        perform_sync_work_on_root(root_cloned.clone(), update_lane.clone());
    }));
    unsafe {
        HOST_CONFIG.as_ref().unwrap()
            .schedule_microtask(Box::new(|| flush_sync_callbacks()));
    }
}
```

而这里并没有直接执行 `perform_sync_work_on_root`，而是通过闭包把任务放到了一个队列中，然后在下一个宏任务或者微任务中一起处理：

Instead of directly executing `perform_sync_work_on_root`, the task is placed into a queue through a closure, and then processed together in the next macro-task or micro-task:

```rust
// packages/react-reconciler/src/sync_task_queue.rs
static mut SYNC_QUEUE: Vec<Box<dyn FnMut()>> = vec![];
static mut IS_FLUSHING_SYNC_QUEUE: bool = false;

pub fn schedule_sync_callback(callback: Box<dyn FnMut()>) {
    unsafe { SYNC_QUEUE.push(callback) }
}

pub fn flush_sync_callbacks() {
    unsafe {
        if !IS_FLUSHING_SYNC_QUEUE && !SYNC_QUEUE.is_empty() {
            IS_FLUSHING_SYNC_QUEUE = true;
            for callback in SYNC_QUEUE.iter_mut() {
                callback();
            }
            SYNC_QUEUE = vec![];
            IS_FLUSHING_SYNC_QUEUE = false;
        }
    }
}

// packages/react-reconciler/src/work_loop.rs
fn ensure_root_is_scheduled(root: Rc<RefCell<FiberRootNode>>) {
  ...
  schedule_sync_callback(Box::new(move || {
      perform_sync_work_on_root(root_cloned.clone(), update_lane.clone());
  }));
  unsafe {
      HOST_CONFIG.as_ref().unwrap()
          .schedule_microtask(Box::new(|| flush_sync_callbacks()));
  }
}

```

`schedule_microtask` 我们按照 `queueMicrotask -> Promise -> setTimeout` 的顺序来选择合适的宏任务或者微任务 API。

In `schedule_microtask`, we choose the appropriate macro-task or micro-task API in the order of `queueMicrotask -> Promise -> setTimeout`.

执行 `perform_sync_work_on_root` 时，会按照 `update_lane` 的优先级来进行渲染，commit 完成后，会把 `update_lane` 从 `pending_lanes` 中剔除：

When executing `perform_sync_work_on_root`, rendering is carried out according to the priority of `update_lane`. After the commit is complete, `update_lane` is removed from `pending_lanes`:

```rust
pub fn mark_root_finished(&mut self, lane: Lane) {
    self.pending_lanes &= !lane;
}
```

这样，当下一个 `perform_sync_work_on_root` 再次执行时，由于得到的最高优先级为 `NoLane`，就不会继续后面的流程了。

In this way, when `perform_sync_work_on_root` is executed again, since the highest priority obtained is `NoLane`, the subsequent process will not continue.

本次更新详见[这里](https://github.com/ParadeTo/big-react-wasm/pull/12)。

For more details on this update, see [here](https://github.com/ParadeTo/big-react-wasm/pull/12).
