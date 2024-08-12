---
title: 从零实现 React v18，但 WASM 版 - [22] 实现 Fragment
date: 2024-08-12 11:56:16
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
> 本文对应 tag：[v23](https://github.com/ParadeTo/big-react-wasm/tree/v23)

Fragment 也是 react 中一个基本的功能，所以 WASM 版本也得支持才行。不过我们先来修复几个比较严重的 Bug。

Bug 1：下面的例子，只有第一次点击会有效果（更新为 1），之后都保持 1 不变。

```js
function App() {
  const [num, setNum] = useState(0)
  return <div onClick={() => setNum((prev) => prev + 1)}>{num}</div>
}
```

原因在于 `update_queue.rs` 更新 `new_base_state` 有问题，需要按如下所示进行修改：

```rust
-   new_base_state = result.memoized_state.clone();
+   new_base_state = new_state.clone();
```

上面的 Bug 修复后，仍然会有问题，还是跟 `useState` 相关。

Bug 2: 下面的例子，只有第一次点击会有效果（更新为 1），之后都保持 1 不变。

```js
function App() {
  const [num, setNum] = useState(0)
  return <div onClick={() => setNum(num + 1)}>{num}</div>
}
```

经过一番定位后，发现 `onClick` 函数中的 `num` 永远都为 0，即使第一次点击后 `num` 已经为 1 了，根本原因在于 `div` 的 `onClick` 引用的一直都是第一次渲染时传入的那个函数，其闭包捕获的 `num` 也是首次渲染时的 0。

翻看代码，发现我们漏了对于 `HostComponent` 这类 `FiberNode` 的 props 的更新逻辑，之前都只处理了 `HostText` 类型，接下来让我们补上这一块。

首先，我们重新定义一下 `HostConfig`，去掉 `commit_text_update`，新增 `commit_update`：

```rust
-    fn commit_text_update(&self, text_instance: Rc<dyn Any>, content: &JsValue);
+    fn commit_update(&self, fiber: Rc<RefCell<FiberNode>>);
```

然后在 `react-dom` 库中重新实现这个 Trait：

```rust
fn commit_update(&self, fiber: Rc<RefCell<FiberNode>>) {
  let instance = FiberNode::derive_state_node(fiber.clone());
  let memoized_props = fiber.borrow().memoized_props.clone();
  match fiber.borrow().tag {
      WorkTag::HostText => {
          let text = derive_from_js_value(&memoized_props, "content");
          self.commit_text_update(instance.unwrap(), &text);
      }
      WorkTag::HostComponent => {
          update_fiber_props(
              instance
                  .unwrap()
                  .downcast::<Node>()
                  .unwrap()
                  .dyn_ref::<Element>()
                  .unwrap(),
              &memoized_props,
          );
      }
      _ => {
          log!("Unsupported update type")
      }
  };
}
```

这里的 `update_fiber_props` 之前就有了，作用就是把最新的 `props` 更新到 `FiberNode` 对应的 `Element` 上面。

然后，在 `complete_work.rs` 中新增如下代码：

```rust
WorkTag::HostComponent => {
        if current.is_some() && work_in_progress_cloned.borrow().state_node.is_some() {
          // todo: compare props to decide if need to update
+         CompleteWork::mark_update(work_in_progress.clone());
```

也就是给 `FiberNode` 打上 `Update` 的标记，这里也可以进一步进行优化（对比前后的 props 来决定是否打标记），简单起见先不加了。

最后，修改 `commit_work.rs` 中对于 `Update` 的处理：

```rust
if flags.contains(Flags::Update) {
  unsafe {
      HOST_CONFIG
          .as_ref()
          .unwrap()
          .commit_update(finished_work.clone())
  }
  finished_work.borrow_mut().flags -= Flags::Update;
}
```

Bug 修复的 PR 见[这里](https://github.com/ParadeTo/big-react-wasm/pull/24)。Bug 修复完毕，接下来实现 `Fragment`。

首先，`Fragment` 是从 `react` 中导出的一个常量，但是在 Rust 中，当我们尝试下面这样写时，会报错 "#[wasm_bindgen] can only be applied to a function, struct, enum, impl, or extern block"：

```rust
#[wasm_bindgen]
pub static Fragment: &str = "react.fragment";
```

看来是不支持从 rust 导出字符串给 JS，那我们只能继续通过构建脚本来修改编译后的产物了，即在最终输出的 JS 文件中加上导出 `Fragment` 的代码。
