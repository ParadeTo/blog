---
title: 从零实现 React v18，但 WASM 版 - [2] 实现 ReactElement
date: 2024-04-04 08:57:19
tags:
  - wasm
  - react
categories:
  - rust
---

> 模仿 [big-react](https://github.com/BetaSu/big-react)，使用 Rust 和 WebAssembly，从 0 到 1 实现从零实现 React v18 的核心功能。深入理解 React 源码的同时，还锻炼了 Rust 的技能，简直赢麻了！
>
> 代码地址：https://github.com/ParadeTo/big-react-wasm
>
> 本文对应 tag：[v2](https://github.com/ParadeTo/big-react-wasm/tree/v2)

# 实现 react 库

[上篇文章]()我们搭建好了开发调式环境，这次我们来实现 react 这个库。

话不多说，我们还是来看看编译后的代码：

![](./big-react-wasm-1/1.png)

我们暂时只关注传入 `jsxDEV` 的前三个参数，他们分别是：

1. `type`，表示 `ReactElement` 的类型，如果是 `HTMLElement` 这里就是它对应的 tag（`string`），如果是用户自定义组件，这里就是 `function`。

2. `props`，传给 `ReactElement` 的参数，包括 `children` 也在这里。
3. `key`，这个不用多说，大家都知道是啥。

按照这个顺序，我们来定义我们的 `jsx_dev` 函数：

```rust

#[wasm_bindgen(js_name = jsxDEV)]
pub fn jsx_dev(_type: &JsValue, config: &JsValue，key: &JsValue) -> JsValue {

}
```

这里有几个点说明下：

1. JsValue 是什么，为什么类型用 JsValue？

JsValue 内部包括了一个 u32 类型的索引，可以用它来获取 JS 中的对象。因为传入函数的这些参数类型是不确定的（比如 \_type 有可能是 `string` 或者 `function`），所以这里只能使用`JsValue`。如果可以保证 key 是字符串，则 key 可以定义为`&str`。

2. 为什么返回不是 `ReactElement` 对象？

因为返回的这个 `ReactElement` 对象，最后还是会传给 react-dom，到时候还是只能定义为 `JsValue`，所以这里也没必要了。

实现这个方法也比较简单，把传入的参数转成如下所示的对象即可：

```
{
  $$typeof: REACT_ELEMENT_TYPE,
  type: type,
  key: key,
  ref: ref,
  props: props,
}
```

代码如下：

```rust
use js_sys::{Object, Reflect};
use wasm_bindgen::prelude::*;

use shared::REACT_ELEMENT_TYPE;

#[wasm_bindgen(js_name = jsxDEV)]
pub fn jsx_dev(_type: &JsValue, config: &JsValue, key: &JsValue) -> JsValue {
    // Initialize an empty object
    let react_element = Object::new();
    // Set properties of react_element using Reflect::set
    Reflect::set(
        &react_element,
        &"&&typeof".into(),
        &JsValue::from_str(REACT_ELEMENT_TYPE),
    )
    .expect("$$typeof panic");
    Reflect::set(&react_element, &"type".into(), _type).expect("_type panic");
    Reflect::set(&react_element, &"key".into(), key).expect("key panic");

    // Iterate config and copy every property to props except ref.
    // The ref property will be set to react_element
    let conf = config.dyn_ref::<Object>().unwrap();
    let props = Object::new();
    for prop in Object::keys(conf) {
        let val = Reflect::get(conf, &prop);
        match prop.as_string() {
            None => {}
            Some(k) => {
                if k == "ref" && val.is_ok() {
                    Reflect::set(&react_element, &"ref".into(), &val.unwrap()).expect("ref panic");
                } else if val.is_ok() {
                    Reflect::set(&props, &JsValue::from(k), &val.unwrap()).expect("props panic");
                }
            }
        }
    }

    // Set props of react_element using Reflect::set
    Reflect::set(&react_element, &"props".into(), &props).expect("props panic");
    // Convert Object into JsValue
    react_element.into()
}

```

为了简单起见，`REACT_ELEMENT_TYPE` 我们没有用 `Symbol`，而是直接用字符串：

```rust
pub static REACT_ELEMENT_TYPE: &str = "react.element";
```

它是定义在 shared 这个项目中的，所以 react 项目中的 `Cargo.toml` 文件还需要加入这一段：

```
[dependencies]
shared = { path = "../shared" }
```

重新构建运行，还是用之前的例子，可以看到如下输出，这样 react 部分就完成了：

![](./big-react-wasm-2/1.png)

本文小试牛刀实现了 WASM 版 React18 中的 react 部分，还是比较简单的，接下来就要开始难度升级了。我们知道 React 一次更新流程分为 render 和 commit 两大阶段，所以下一篇我们来实现 render 阶段。

#
