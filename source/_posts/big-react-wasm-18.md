---
title: 从零实现 React v18，但 WASM 版 - [18] 实现 useRef, useCallback, useMemo
date: 2024-07-10 15:39:13
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
> 本文对应 tag：[v18](https://github.com/ParadeTo/big-react-wasm/tree/v18)

> Based on [big-react](https://github.com/BetaSu/big-react)，I am going to implement React v18 core features from scratch using WASM and Rust.
>
> Code Repository：https://github.com/ParadeTo/big-react-wasm
>
> The tag related to this article：[v18](https://github.com/ParadeTo/big-react-wasm/tree/v18)

前面已经实现了 `useState` 和 `useEffect` 两个常用的 hooks，今天我们继续来实现 `useRef`, `useCallback`, `useMemo` 这三个。

由于前面框架已经搭好，所以我们的 `react` 包中只需要依葫芦画瓢，把这三个加进去就好了：

We have already implemented two commonly used hooks, `useState` and `useEffect`, earlier. Today, we will continue to implement three more hooks: `useRef`, `useCallback`, and `useMemo`.

Since the framework has already been set up, we can simply follow the same pattern and add these three hooks to our `react` package.

```rust
// react/src/lib.rs
#[wasm_bindgen(js_name = useRef)]
pub unsafe fn use_ref(initial_value: &JsValue) -> JsValue {
    let use_ref = &CURRENT_DISPATCHER.current.as_ref().unwrap().use_ref;
    use_ref.call1(&JsValue::null(), initial_value)
}

#[wasm_bindgen(js_name = useMemo)]
pub unsafe fn use_memo(create: &JsValue, deps: &JsValue) -> Result<JsValue, JsValue> {
    let use_memo = &CURRENT_DISPATCHER.current.as_ref().unwrap().use_memo;
    use_memo.call2(&JsValue::null(), create, deps)
}

#[wasm_bindgen(js_name = useCallback)]
pub unsafe fn use_callback(callback: &JsValue, deps: &JsValue) -> JsValue {
    let use_callback = &CURRENT_DISPATCHER.current.as_ref().unwrap().use_callback;
    use_callback.call2(&JsValue::null(), callback, deps)
}
```

```rust
// react/src/current_dispatcher.rs
pub unsafe fn update_dispatcher(args: &JsValue) {
    ...
    let use_ref = derive_function_from_js_value(args, "use_ref");
    let use_memo = derive_function_from_js_value(args, "use_memo");
    let use_callback = derive_function_from_js_value(args, "use_callback");
    CURRENT_DISPATCHER.current = Some(Box::new(Dispatcher::new(
        use_state,
        use_effect,
        use_ref,
        use_memo,
        use_callback,
    )))
}
```

接着，我们来看看 `react-reconciler` 中需要怎么修改。

Next, let's take a look at how we need to modify `react-reconciler`.

# useRef

首先需要在 `fiber_hooks.rs` 中，增加 `mount_ref` 和 `update_ref`：

First, we need to add `mount_ref` and `update_ref` in `fiber_hooks.rs`.

```rust
fn mount_ref(initial_value: &JsValue) -> JsValue {
    let hook = mount_work_in_progress_hook();
    let ref_obj: Object = Object::new();
    Reflect::set(&ref_obj, &"current".into(), initial_value);
    hook.as_ref().unwrap().borrow_mut().memoized_state =
        Some(MemoizedState::MemoizedJsValue(ref_obj.clone().into()));
    ref_obj.into()
}

fn update_ref(initial_value: &JsValue) -> JsValue {
    let hook = update_work_in_progress_hook();
    match hook.unwrap().borrow_mut().memoized_state.clone() {
        Some(MemoizedState::MemoizedJsValue(value)) => value,
        _ => panic!("ref is none"),
    }
}
```

对于 `useRef` 来说，这两个方法实现起来非常简单。

接着，按照渲染流程的顺序，首先要修改 `begin_work.rs`，这里我们暂时只处理 Host Component 类型的 `FiberNode`：

For `useRef`, these two methods can be implemented very simply.

Next, following the order of the rendering process, we need to modify `begin_work.rs` first. Here, we will only handle `FiberNode` of the Host Component type for now.

```rust
fn mark_ref(current: Option<Rc<RefCell<FiberNode>>>, work_in_progress: Rc<RefCell<FiberNode>>) {
    let _ref = { work_in_progress.borrow()._ref.clone() };
    if (current.is_none() && !_ref.is_null())
        || (current.is_some() && Object::is(&current.as_ref().unwrap().borrow()._ref, &_ref))
    {
        work_in_progress.borrow_mut().flags |= Flags::Ref;
    }
}
fn update_host_component(
    work_in_progress: Rc<RefCell<FiberNode>>,
) -> Option<Rc<RefCell<FiberNode>>> {
  ...
  let alternate = { work_in_progress.borrow().alternate.clone() };
  mark_ref(alternate, work_in_progress.clone());
  ...
}
```

处理方式也很简单，根据条件给 `FiberNode` 打上 `Ref` 的标记，供 commit 阶段处理。

然后，需要在 `work_loop.rs` 中的 `commit_root` 方法中增加“layout 阶段”：

The handling process is also straightforward. We can mark the `FiberNode` with a `Ref` flag based on certain conditions, which will be processed during the commit phase.

Next, we need to add the "layout phase" in the `commit_root` method in `work_loop.rs`.

```rust
// 1/3: Before Mutation

// 2/3: Mutation
commit_mutation_effects(finished_work.clone(), root.clone());

// Switch Fiber Tree
cloned.borrow_mut().current = finished_work.clone();

// 3/3: Layout
commit_layout_effects(finished_work.clone(), root.clone());
```

该阶段发生在 `commit_mutation_effects` 之后，也即修改 DOM 之后，所以我们可以在这里更新 Ref。

`commit_layout_effects` 会根据 `FiberNode` 节点上是否包含 `Ref` 标记来决定是否更新 Ref，即调用 `safely_attach_ref` 这个方法：

This phase occurs after `commit_mutation_effects`, which means it happens after modifying the DOM. So we can update the Ref here.

In `commit_layout_effects`, we can decide whether to update the Ref based on whether the `FiberNode` contains the `Ref` flag. We can do this by calling the `safely_attach_ref` method.

```rust
if flags & Flags::Ref != Flags::NoFlags && tag == HostComponent {
    safely_attach_ref(finished_work.clone());
    finished_work.borrow_mut().flags -= Flags::Ref;
}
```

而 `safely_attach_ref` 中先是从 `FiberNode` 中取出 `state_node` 属性，该属性指向 `FiberNode` 对应的真实节点，对于 React DOM 来说，就是 DOM 节点，
然后，根据 `_ref` 值的类型进行不同的处理：

In `safely_attach_ref`, we first retrieve the `state_node` property from the `FiberNode`. This property points to the actual node corresponding to the `FiberNode`. For React DOM, it would be the DOM node.

Next, we handle different cases based on the type of the `_ref` value.

```rust
fn safely_attach_ref(fiber: Rc<RefCell<FiberNode>>) {
    let _ref = fiber.borrow()._ref.clone();
    if !_ref.is_null() {
        let instance = match fiber.borrow().state_node.clone() {
            Some(s) => match &*s {
                StateNode::Element(element) => {
                    let node = (*element).downcast_ref::<Node>().unwrap();
                    Some(node.clone())
                }
                StateNode::FiberRootNode(_) => None,
            },
            None => None,
        };

        if instance.is_none() {
            panic!("instance is none")
        }

        let instance = instance.as_ref().unwrap();
        if type_of(&_ref, "function") {
            // <div ref={() => {...}} />
            _ref.dyn_ref::<Function>()
                .unwrap()
                .call1(&JsValue::null(), instance);
        } else {
            // const ref = useRef()
            // <div ref={ref} />
            Reflect::set(&_ref, &"current".into(), instance);
        }
    }
}
```

到此， `useRef` 就实现完毕了，接下来看看另外两个。

By now, the implementation of `useRef` is complete. Let's move on to the other two hooks.

# useCallback 和 useMemo

这两个 hooks 实现起来就更简单了，只需要修改 `fiber_hooks` 即可，而且两者的实现方式非常类似。以 `useCallback` 为例，首次渲染时，只需把传入 `useCallback` 的两个参数保存在 `Hook` 节点上，然后将第一个参数返回即可：

The implementation of these two hooks becomes simpler. You just need to modify `fiber_hooks`, and both of them have very similar implementation approaches. Taking `useCallback` as an example, during the initial render, you only need to save the two arguments passed to `useCallback` on the `Hook` node and then return the first argument.

```rust
fn mount_callback(callback: Function, deps: JsValue) -> JsValue {
    let hook = mount_work_in_progress_hook();
    let next_deps = if deps.is_undefined() {
        JsValue::null()
    } else {
        deps
    };
    let array = Array::new();
    array.push(&callback);
    array.push(&next_deps);
    hook.as_ref().unwrap().clone().borrow_mut().memoized_state =
        Some(MemoizedState::MemoizedJsValue(array.into()));
    callback.into()
}
```

更新的时候，先取出之前保存的第二个参数跟新传入的第二个参数进行逐项对比，如果全部相同则返回之前保存的第一个参数，否则返回新传入的第一个参数：

When updating, you first retrieve the previously saved second argument and compare it item by item with the new second argument that is passed in. If they are all the same, you return the previously saved first argument. Otherwise, you return the new first argument that was passed in.

```rust
fn update_callback(callback: Function, deps: JsValue) -> JsValue {
    let hook = update_work_in_progress_hook();
    let next_deps = if deps.is_undefined() {
        JsValue::null()
    } else {
        deps
    };

    if let MemoizedState::MemoizedJsValue(prev_state) = hook
        .clone()
        .unwrap()
        .borrow()
        .memoized_state
        .as_ref()
        .unwrap()
    {
        if !next_deps.is_null() {
            let arr = prev_state.dyn_ref::<Array>().unwrap();
            let prev_deps = arr.get(1);
            if are_hook_inputs_equal(&next_deps, &prev_deps) {
                return arr.get(0);
            }
        }
        let array = Array::new();
        array.push(&callback);
        array.push(&next_deps);
        hook.as_ref().unwrap().clone().borrow_mut().memoized_state =
            Some(MemoizedState::MemoizedJsValue(array.into()));
        return callback.into();
    }
    panic!("update_callback, memoized_state is not JsValue");
}
```

而 `useMemo` 只是多了一步执行函数的操作，其他步骤一模一样。

到此，这两个 hooks 也实现完毕了，不过这两个 hooks 目前起不到什么作用，因为我们还没有实现性能优化相关的功能，这个就留到下一篇吧。

本次更新详见[这里](https://github.com/ParadeTo/big-react-wasm/pull/18)，跪求 star 并关注公众号“前端游”。

For `useMemo`, it simply adds an extra step of executing the function, but the other steps remain the same.

With this, the implementation of these two hooks is complete. However, currently, these two hooks don't provide any performance optimization features because we haven't implemented them yet. Let's leave that for the next article.

For the details of this update, please refer to [here](https://github.com/ParadeTo/big-react-wasm/pull/18). Please kindly give me a star!
