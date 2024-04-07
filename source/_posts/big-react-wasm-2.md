---
title: 从零实现 React v18，但 WASM 版 - [2] 实现 ReactElement
date: 2024-04-04 08:57:19
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
> 本文对应 tag：[v2](https://github.com/ParadeTo/big-react-wasm/tree/v2)

# 实现 react 库

[上篇文章](/2024/04/03/big-react-wasm-1/)我们搭建好了开发调式环境，这次我们来实现 react 这个库。

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

JsValue 内部包括了一个 u32 类型的索引，可以通过这个索引来访问 JS 中的对象，详情见文末。

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

# 补充：JsValue 原理探究

前面简单的讲了下 JsValue，现在我们进一步来研究下其原理。首先我们来看看 `wasm-pack` 打包后的 `jsx-dev-runtime_bg.js` 文件中的代码，我们找到 `jsxDEV` 函数：

```js
export function jsxDEV(_type, config, key) {
  try {
    const ret = wasm.jsxDEV(
      addBorrowedObject(_type),
      addBorrowedObject(config),
      addBorrowedObject(key)
    )
    return takeObject(ret)
  } finally {
    heap[stack_pointer++] = undefined
    heap[stack_pointer++] = undefined
    heap[stack_pointer++] = undefined
  }
}
```

传入的参数都被 `addBorrowedObject` 这个方法处理过，那么继续来看看它：

```js
const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);
let stack_pointer = 128;
...
function addBorrowedObject(obj) {
  if (stack_pointer == 1) throw new Error('out of js stack')
  heap[--stack_pointer] = obj
  return stack_pointer
}
```

哦，原来是在 JS 这边通过 `Array` 模拟了一个堆结构，把参数都存到了这个堆上，上面三个参数会按如下方式存放：

![](./big-react-wasm-2/2.png)

而真正传入 `wasm.jsxDEV` 中的竟然只是数组的下标而已。那 WASM 这边是怎么通过这个索引获取到真正的对象的呢？比如，这个代码 `Reflect::get(conf, &prop);` 是怎么工作的呢？

仔细想想，既然数据还在 JS 这边，传给 WASM 的只是索引，那必然 JS 这边还必须提供一些接口给 WASM 那边调用才行。我们继续看 `jsx-dev-runtime_bg.js` 中的代码，发现有一个 `getObject(idx)` 的方法，他的作用是通过索引来获取堆中的数据：

```js
function getObject(idx) {
  return heap[idx]
}
```

那我们在这个函数打个断点，不断下一步，直到来到这样一个调用栈：

![](./big-react-wasm-2/3.png)

WASM 中显示调用了 `__wbg_get_e3c254076557e348` 这个方法：

![](./big-react-wasm-2/5.png)

`__wbg_get_e3c254076557e348` 这个方法在 `jsx-dev-runtime_bg.js` 可以找到：

```js
export function __wbg_get_e3c254076557e348() {
  return handleError(function (arg0, arg1) {
    const ret = Reflect.get(getObject(arg0), getObject(arg1))
    return addHeapObject(ret)
  }, arguments)
}
```

此时，相关的数据如图所示：

![](./big-react-wasm-2/4.png)

相当于是在执行 Rust 代码中的这一步：

```rust
let val = Reflect::get(conf, &prop); // prop 为 children
```

到此，真相大白。
