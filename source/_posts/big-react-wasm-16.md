---
title: 从零实现 React v18，但 WASM 版 - [16] 实现 React Noop
date: 2024-06-06 17:19:04
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
> 本文对应 tag：[v16](https://github.com/ParadeTo/big-react-wasm/tree/v16)

之前的文章总是在说要实现 React Noop 用于单元测试，今天就来完成这个任务。

首先，我们按照之前的方式，在 react-dom 同级目录下新建一个 react-noop：

```
├── packages
│   ├── react
│   ├── react-dom
│   ├── react-noop
│   ├── react-reconciler
│   ├── scheduler
│   └── shared
```

项目结构与 react-dom 类似，不同之处在于 react-noop 对于 `HostConfig` 的实现方式不同。比如 react-dom 中的 `create_instance` 返回的是一个 `Element` 对象：

```rust
fn create_instance(&self, _type: String, props: Rc<dyn Any>) -> Rc<dyn Any> {
  let window = window().expect("no global `window` exists");
  let document = window.document().expect("should have a document on window");
  match document.create_element(_type.as_ref()) {
      Ok(element) => {
          let element = update_fiber_props(
              element.clone(),
              &*props.clone().downcast::<JsValue>().unwrap(),
          );
          Rc::new(Node::from(element))
      }
      Err(_) => {
          panic!("Failed to create_instance {:?}", _type);
      }
  }
}
```

而 react-noop 返回的是一个普通的 JS 对象：

```rust
fn create_instance(&self, _type: String, props: Rc<dyn Any>) -> Rc<dyn Any> {
  let obj = Object::new();
  Reflect::set(&obj, &"id".into(), &getCounter().into());
  Reflect::set(&obj, &"type".into(), &_type.into());
  Reflect::set(&obj, &"children".into(), &**Array::new());
  Reflect::set(&obj, &"parent".into(), &JsValue::from(-1.0));
  Reflect::set(
      &obj,
      &"props".into(),
      &*props.clone().downcast::<JsValue>().unwrap(),
  );
  Rc::new(JsValue::from(obj))
}
```

其他方法也都是对普通 JS 对象的操作而已，具体请看[这里](https://github.com/ParadeTo/big-react-wasm/pull/15)。

另外，为了方便测试，还需要新增一个 `getChildrenAsJSX` 的方法：

```rust
impl Renderer {
    ...
    pub fn getChildrenAsJSX(&self) -> JsValue {
        let mut children = derive_from_js_value(&self.container, "children");
        if children.is_undefined() {
            children = JsValue::null();
        }
        children = child_to_jsx(children);

        if children.is_null() {
            return JsValue::null();
        }
        if children.is_array() {
            todo!("Fragment")
        }
        return children;
    }
}
```

这样就可以通过 `root` 来得到一颗包含 JSX 对象的树状结构了，比如下面的代码：

```js
const ReactNoop = require('react-noop')
const root = ReactNoop.createRoot()
root.render(
  <div>
    <p>hello</p>
    <span>world</span>
  </div>
)
setTimeout(() => {
  console.log('---------', root.getChildrenAsJSX())
}, 1000)
```

最终打印的结果会是：

```js
{
  $$typeof: 'react.element',
  type: 'div',
  key: null,
  ref: null,
  props: {
    children: [
      {
        $$typeof: 'react.element',
        type: 'p',
        key: null,
        ref: null,
        props: {
          children: 'hello',
        },
      },
      {
        $$typeof: 'react.element',
        type: 'span',
        key: null,
        ref: null,
        props: {
          children: 'world',
        },
      },
    ],
  },
}
```

注意到上面打印结果的代码放在了 `setTimeout` 中，是因为我们在实现 Batch Update 的时候把更新流程放在了宏任务中，可参考[这篇文章](/2024/05/11/big-react-wasm-13/)。

然后，我们把 react-noop 也加入到构建脚本中，并设置构建 target 为 `nodejs`，这样我们就能在 Node.js 环境中使用了。不过要想在 Node.js 中支持 jsx 语法，还得借助 babel，这里我们直接使用 babel-node 来运行我们的脚本即可，并配置好相关的 preset：

```js
// .babelrc
{
  "presets": [
    [
      "@babel/preset-react",
      {
        "development": "true"
      }
    ]
  ]
}
```

不出意外的话，上面的代码就可以正常运行在 Node.js 中了。不过，当我尝试在 jest 中使用 react-noop 时，却运行出错：

```js
work_loop error JsValue(RuntimeError: unreachable
    RuntimeError: unreachable
        at null.<anonymous> (wasm://wasm/00016f66:1:14042)
        ...
```

由于一直无法解决，所以最后不得不在 Node.js 中来进行单元测试，下面是一个用例：

```js
async function test1() {
  const arr = []

  function Parent() {
    useEffect(() => {
      return () => {
        arr.push('Unmount parent')
      }
    })
    return <Child />
  }

  function Child() {
    useEffect(() => {
      return () => {
        arr.push('Unmount child')
      }
    })
    return 'Child'
  }

  root.render(<Parent a={1} />)
  await sleep(10)
  if (root.getChildrenAsJSX() !== 'Child') {
    throw new Error('test1 failed')
  }

  root.render(null)
  await sleep(10)
  if (arr.join(',') !== 'Unmount parent,Unmount child') {
    throw new Error('test1 failed')
  }
}
```

执行 `test1` 成功，说明我们的 React Noop 可以正常工作了。
