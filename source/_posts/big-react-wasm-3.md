---
title: 从零实现 React v18，但 WASM 版 - [3] Renderer 和 Reconciler 架构设计
date: 2024-04-07 10:33:52
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
> 本文对应 tag：[v3](https://github.com/ParadeTo/big-react-wasm/tree/v3)

> Based on [big-react](https://github.com/BetaSu/big-react)，I am going to implement React v18 core features from scratch using WASM and Rust.
>
> Code Repository：https://github.com/ParadeTo/big-react-wasm
>
> The tag related to this article：[v3](https://github.com/ParadeTo/big-react-wasm/tree/v3)

# 前言

# Introduction

上一篇文章末本计划本篇实现 render 阶段，但考虑到内容太多，还是分开写比较好。说是架构设计，有点夸张了，其实主要的目的在于要实现 `Renderer` 和 `Reconciler` 的解耦，让 `Reconciler` 可以支持不同的 `Renderer`，因为后续还需要实现 `ReactNoop` Renderer 用来跑测试用例。

In the previous article, the plan was to implement the render phase in this article. However, considering the amount of content, it is better to separate it into multiple parts. Calling it "architecture design" may be a bit exaggerated. The main goal is to decouple the Renderer and Reconciler to enable the Reconciler to support different Renderer implementations. This is necessary because we will need to implement the ReactNoop Renderer for running test cases in the future.

# Reconciler

Rust 中要实现我们的目的，离不开 Trait，所以我们在 `Reconciler` 中先定义好 `HostConfig` Trait：

To achieve our goal in Rust, traits are indispensable. Therefore, we first define the `HostConfig` trait in the `Reconciler` to lay the foundation:

```rust
// react-reconciler/src/lib.rs
pub trait HostConfig {
    fn create_text_instance(&self, content: String) -> Rc<dyn Any>;
    fn create_instance(&self, _type: Rc<dyn Any>) -> Rc<dyn Any>;
    fn append_initial_child(&self, parent: Rc<dyn Any>, child: Rc<dyn Any>);
    fn append_child_to_container(&self, child: Rc<dyn Any>, parent: Rc<dyn Any>);
}
```

这里暂时只定义了部分方法，需要注意的是由于不同 `Renderer` 下的 `stateNode` 是不一样的，这里的类型都不能确定，所以使用了 `std::any::Any`。

Here, only a few methods are defined, and it's important to note that the `stateNode` under different `Renderers` can have different types. To handle this uncertainty, the `std::any::Any` type is used.

接着来定义 `Reconciler`：

Next, let's define the `Reconciler`:

```rust
// react-reconciler/src/lib.rs
pub struct Reconciler {
    host_config: Box<dyn HostConfig>,
}

impl Reconciler {
    pub fn new(host_config: Box<dyn HostConfig>) -> Self {
        Reconciler { host_config }
    }
    pub fn create_container(&self, container: &JsValue) -> Rc<RefCell<FiberRootNode>> {
        Rc::new(RefCell::new(FiberRootNode {}))
    }

    pub fn update_container(&self, element: Rc<JsValue>, root: Rc<RefCell<FiberRootNode>>) {
        log!("{:?} {:?}", element, root)
    }
}
```

`Reconciler` 中包含 `host_config` 属性，使用 Trait Object 来表示泛型，当某个 `Renderer` 中实例化一个 `Reconciler` 对象时，需要传入实现了 `HostConfig` Trait 的类型的实例。

In the `Reconciler` struct, the `host_config` property is included and uses a Trait Object to represent the generic type. When instantiating a `Reconciler` object within a specific `Renderer`, an instance of a type that implements the `HostConfig` trait needs to be passed.

其他两个方法先简单的实现一下，供调试用。接下来看看 `Renderer`。

Let's implement the other two methods quickly for debugging purposes. Next, we'll take a look at the `Renderer`.

# Renderer

Renderer 中当然首先要实现 `HostConfig`：

The first thing in Renderer is to implement the `HostConfig`.

```rust
// react-dom/src/host_config.rs
use react_reconciler::HostConfig;


impl HostConfig for ReactDomHostConfig {
    fn create_text_instance(&self, content: String) -> Rc<dyn Any> {
        let window = window().expect("no global `window` exists");
        let document = window.document().expect("should have a document on window");
        Rc::new(document.create_text_node(content.as_str()))
    }

    fn create_instance(&self, _type: String) -> Rc<dyn Any> {
        let window = window().expect("no global `window` exists");
        let document = window.document().expect("should have a document on window");
        match document.create_element(_type.as_ref()) {
            Ok(element) => Rc::new(element),
            Err(_) => todo!(),
        }
    }

    fn append_initial_child(&self, parent: Rc<dyn Any>, child: Rc<dyn Any>) {
        let parent = parent.clone().downcast::<Element>().unwrap();
        let child = child.downcast::<Text>().unwrap();
        match parent.append_child(&child) {
            Ok(_) => {
                log!("append_initial_child successfully ele {:?} {:?}", parent, child);
            }
            Err(_) => todo!(),
        }
    }

    fn append_child_to_container(&self, child: Rc<dyn Any>, parent: Rc<dyn Any>) {
        todo!()
    }
}
```

可以看到我们可以通过 `downcast` 把 `Any` 类型转化为具体的类型，这里暂时都很简单地实现了一下。

然后我们定义一个 `Renderer`：

As we can see, we can use `downcast` to convert the `Any` type into a specific type. Here, we have implemented the method in a simple manner for now.

Next, let's define a `Renderer`:

```rust
// react-dom/src/renderer.rs
#[wasm_bindgen]
pub struct Renderer {
    root: Rc<RefCell<FiberRootNode>>,
    reconciler: Reconciler,
}

impl Renderer {
    pub fn new(root: Rc<RefCell<FiberRootNode>>, reconciler: Reconciler) -> Self {
        Self { root, reconciler }
    }
}

#[wasm_bindgen]
impl Renderer {
    pub fn render(&self, element: &JsValue) {
        self.reconciler.update_container(Rc::new(element.clone()), self.root.clone())
    }
}
```

他包含 `root` 和 `reconciler` 两个属性，其中 `root` 是在调用 `create_root` 时通过 `Reconciler` 的 `create_container` 方法生成的：

The `Renderer` includes two properties, `root` and `reconciler`. The root is generated by the `create_container` method of the `Reconciler` when `create_root` is called.

```rust
#[wasm_bindgen(js_name = createRoot)]
pub fn create_root(container: &JsValue) -> Renderer {
    set_panic_hook();
    let reconciler = Reconciler::new(Box::new(ReactDomHostConfig));
    let root = reconciler.create_container(container);
    let renderer = Renderer::new(root, reconciler);
    renderer
}
```

# 测试

# Testing

一切就绪了，我们加点代码来调试一下，我们把 `hello-world` 中的例子改成如下所示：

Everything is ready, let's add some code to debug. We'll modify the example in `hello-world` as follows:

```js
import {createRoot} from 'react-dom'

const comp = <div>hello world</div>
const root = createRoot(document.getElementById('root'))
root.render(comp)
```

然后在 `Reconciler` 中，我们先硬编码实现首次渲染：

Then, in the `Reconciler`, let's start by implementing the initial rendering with hardcoded content:

```rust
pub fn update_container(&self, element: Rc<JsValue>, root: Rc<RefCell<FiberRootNode>>) {
    let props = Reflect::get(&*element, &JsValue::from_str("props")).unwrap();
    let _type = Reflect::get(&*element, &JsValue::from_str("type")).unwrap();
    let children = Reflect::get(&props, &JsValue::from_str("children")).unwrap();

    let text_instance = self.host_config.create_text_instance(children.as_string().unwrap());
    let div_instance = self.host_config.create_instance(_type.as_string().unwrap());
    self.host_config.append_initial_child(div_instance.clone(), text_instance);

    let window = window().unwrap();
    let document = window.document().unwrap();
    let body = document.body().expect("document should have a body");

    body.append_child(&*div_instance.clone().downcast::<Element>().unwrap());
}
```

不出意外，重新构建并安装依赖，运行 hello world 项目就可以在浏览器中看到内容了。

If everything goes well, rebuild and install the dependencies. You should be able to see the content in the browser when running the hello world project.
