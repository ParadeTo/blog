---
title: 从零实现 React v18，但 WASM 版 - [10] 实现单节点更新流程
date: 2024-04-26 12:05:22
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
> 本文对应 tag：[v10](https://github.com/ParadeTo/big-react-wasm/tree/v10)

上上篇文章末尾说了我们目前还没有完整的实现更新流程，所以这篇文章我们来实现一下。

还是用之前的例子：

```js
function App() {
  const [name, setName] = useState(() => 'ayou')
  setTimeout(() => {
    setName('ayouayou')
  }, 1000)
  return (
    <div>
      <Comp>{name}</Comp>
    </div>
  )
}
```

当我们调用 `setName('ayouayou')` 时，会触发更新流程，而 `setName` 这个方法是在首次渲染的时候在 `mount_state` 中返回的，该方法会在当前 `FiberNode` 的 `memoized_state` 上挂载一个 `Hook` 节点，如果有多个 Hooks, 会形成一个链表。`Hook` 节点上有个 `update_queue`，显而易见，这是个更新队列。还有个 `memoized_state` 属性，记录当前 `Hook` 的状态：

```rust
fn mount_state(initial_state: &JsValue) -> Result<Vec<JsValue>, JsValue> {
  // Add hook to current FiberNode memoized_state
  let hook = mount_work_in_progress_hook();
  let memoized_state: JsValue;

  if initial_state.is_function() {
    memoized_state = initial_state
        .dyn_ref::<Function>()
        .unwrap()
        .call0(&JsValue::null())?;
  } else {
      memoized_state = initial_state.clone();
  }

  hook.as_ref().unwrap().clone().borrow_mut().memoized_state =
      Some(MemoizedState::JsValue(memoized_state.clone()));
  let queue = create_update_queue();
  hook.as_ref().unwrap().clone().borrow_mut().update_queue = Some(queue.clone());
  ...
}
```

`mount_state` 最终会返回 `initial_state` 和一个函数：

```rust
let q_rc = Rc::new(queue.clone());
let q_rc_cloned = q_rc.clone();
let fiber = unsafe {
    CURRENTLY_RENDERING_FIBER.clone().unwrap()
};
let closure = Closure::wrap(Box::new(move |action: &JsValue| unsafe {
    dispatch_set_state(
        fiber.clone(),
        (*q_rc_cloned).clone(),
        action,
    )
}) as Box<dyn Fn(&JsValue)>);
let function = closure.as_ref().unchecked_ref::<Function>().clone();
closure.forget();

queue.clone().borrow_mut().dispatch = Some(function.clone());

Ok(vec![memoized_state, function.into()])
```

这里有点奇怪的是 `closure` 中的 `q_rc_cloned`，明明 `queue` 已经是个 `Rc` 类型了，为什么还要在外面再包一层 `Rc`？因为如果把 `(*q_rc_cloned).clone()` 改成 `queue.clone()`，会报如下错误：

```rust
error[E0382]: borrow of moved value: `queue`
   --> packages/react-reconciler/src/fiber_hooks.rs:251:5
    |
233 |     let queue = create_update_queue();
    |         ----- move occurs because `queue` has type `Rc<RefCell<UpdateQueue>>`, which does not implement the `Copy` trait
...
240 |     let closure = Closure::wrap(Box::new(move |action: &JsValue| unsafe {
    |                                          ----------------------- value moved into closure here
...
243 |             queue.clone(),
    |             ----- variable moved due to use in closure
...
251 |     queue.clone().borrow_mut().dispatch = Some(function.clone());
    |     ^^^^^ value borrowed here after move

```

原因在于 `queue` 的值的所有权已经被 move 进闭包中了，外面不能再继续使用了。那去掉 move 行么？试试看，结果发现会报这个错误：

```rust
error[E0597]: `queue` does not live long enough
   --> packages/react-reconciler/src/fiber_hooks.rs:243:13
    |
240 |       let closure = Closure::wrap(Box::new(|action: &JsValue| unsafe {
    |                                   -        ------------------ value captured here
    |  _________________________________|
    | |
241 | |         dispatch_set_state(
242 | |             fiber.clone(),
243 | |             queue.clone(),
    | |             ^^^^^ borrowed value does not live long enough
...   |
246 | |         )
247 | |     }) as Box<dyn Fn(&JsValue)>);
    | |______- cast requires that `queue` is borrowed for `'static`
...
254 |   }
    |   - `queue` dropped here while still borrowed
```

原因在于，如果不 move 进去，`queue` 在 `mount_state` 执行完后就会被回收，而闭包里面却仍然在借用，显然不行。

都说 Rust 学习曲线陡峭的原因就在此，因为写代码的大部分时候都在和编译器作斗争。不过 Rust 的理念就是这样，在程序编译时就把大部分的问题给发现出来，这样修复的效率比上线后发现再修复的效率要高得多。而且，Rust 编译器也很智能，给出的问题描述一般都很清晰。

继续回到使用 move 和 `queue` 的错误。分析一下，因为 `queue` 被 move 了，所以后面不能使用 `queue`，那么如果我们 move 一个别的东西不就可以了么，所以就有了 `queue_rc`，两者的内存模型对比如下所示：

![](./big-react-wasm-10/1.png)

还有一个值得说明的地方是，我们把这个闭包函数挂载到了每个 `Hook` 节点的 `dispatch` 属性上：

```rust
queue.clone().borrow_mut().dispatch = Some(function.clone());
```

是为了在 `update_state` 时返回同样的函数：

```rust
fn update_state(initial_state: &JsValue) -> Result<Vec<JsValue>, JsValue> {
   ...
    Ok(vec![
        hook.clone().unwrap().clone()
            .borrow()
            .memoized_state
            .clone()
            .unwrap()
            .js_value()
            .unwrap().clone(),
        queue.clone().unwrap().borrow().dispatch.clone().into(),
    ])
}
```

不过我感觉这个 `dispatch` 作为 `Hook` 的属性更合适，至少目前来看它跟 `queue` 好像没什么关联。

回到代码，当调用 `dispatch` 时，最后会调用 `dispatch_set_state`：

```rust
fn dispatch_set_state(
    fiber: Rc<RefCell<FiberNode>>,
    update_queue: Rc<RefCell<UpdateQueue>>,
    action: &JsValue,
) {
    let update = create_update(action.clone());
    enqueue_update(update_queue.clone(), update);
    unsafe {
        WORK_LOOP
            .as_ref()
            .unwrap()
            .clone()
            .borrow()
            .schedule_update_on_fiber(fiber.clone());
    }
}
```

它的作用就是使用传入的 `action` 更新 `Hook` 节点的 `update_queue`，并开启一轮新的更新流程，此时 `App` 节点状态如下图所示：

![](./big-react-wasm-10/2.png)

接下来流程跟首次渲染类似，首先看 begin work，更新过程的 begin work 主要是对于 `FiberNode` 的子节点的处理，它通过当前 Fiber Tree 中的子 `FiberNode` 节点和新产生的 `ReactElement` children 来产生新的子 `FiberNode`，也就是我们常说的 diff 过程：

![](./big-react-wasm-10/3.png)

其中，不同类型的 `FiberNode` 节点产生 `ReactElement` children 的方式有所不同：

- HostRoot：从 `memoized_state` 取值
- HostComponent：从 `pending_props` 中取值
- FunctionComponent：通过执行 `_type` 指向的 Function 来得到
- HostText：没有这个过程，略

而如何产生这个新的子 `FiberNode`，也有两种情况：

测试多个 Hook
beginWork 中处理 Placement Deletion
completeWork 中处理 Update
