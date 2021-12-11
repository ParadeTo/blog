---
title: React 远程动态组件实践
date: 2021-12-10 17:27:17
tags:
  - react
categories:
  - javascript
description: 介绍一种 React 远程动态组件的实现方式
---

# 背景

想象有这样一个场景：A 团队开发了一套组件库，B 和 C 团队都在各自的业务项目中使用了该组件库。现在 A 团队需要对某个组件进行更新（比如修改颜色），按照以往的做法，A 团队需要先发布一个新的版本，然后其他两个团队各自更新业务项目中所依赖的组件库的版本后发布上线。

有没有更快速的方法呢？比如能否做到只更新组件库，其他依赖它的项目可以自动获取到其最新的版本，即实现远程动态组件。答案是有的，Webpack 5 新增的 Module Federation 就可以实现这个需求，但是今天我们要讨论的是另外一种方法。

# 远程动态组件实现

## 远程动态组件库

远程动态组件库项目结构如下所示：

```js
.
├── babel.config.js
├── package.json
├── rollup.config.js
└── src
    ├── Button.js
    ├── Text.js
```

我们简单实现了两个组件 `Button` 和 `Text`：

```js
import React from 'react'

export default ({children}) => {
  return <button style={{color: 'blue'}}>{children}</button>
}
```

```js
import React from 'react'

export default ({children}) => {
  return <span style={{color: 'blue'}}>{children}</span>
}
```

我们使用 rollup 对其进行打包，之所以用 rollup 是因为其打包出来的代码非常简洁，方便我们查看，rollup 配置为：

```js
import babel from 'rollup-plugin-babel'
import fs from 'fs'

const components = fs.readdirSync('./src')

export default components.map((filename) => {
  return {
    input: `./src/${filename}`,
    output: {
      file: `dist/${filename}`,
      format: 'cjs',
    },
    plugins: [babel()],
  }
})
```

打包后的结果如下所示：

```js
.
├── dist
│   └── Button.js
│   └── Text.js
```

其中 `Button.js` 如下所示：

```js
'use strict'

var React = require('react')

function _interopDefaultLegacy(e) {
  return e && typeof e === 'object' && 'default' in e ? e : {default: e}
}

var React__default = /*#__PURE__*/ _interopDefaultLegacy(React)

var Button = function (_ref) {
  var children = _ref.children
  return /*#__PURE__*/ React__default['default'].createElement(
    'button',
    {
      style: {
        color: 'blue',
      },
    },
    children
  )
}

module.exports = Button
```

然后我们使用 http-server 在 `dist` 目录下开启一个静态文件服务，则可以通过 `http://localhost:8080/Button.js` 获取到打包后的代码。

远程组件库介绍完毕，接下来介绍业务项目中如何使用。

## 接入远程组件库

我们使用 `create-react-app` 创建一个 React 应用，并新增一个 `DynamicComponent` 组件：

```js
const DynamicComponent = ({name, children, ...props}) => {
  const Component = useMemo(() => {
    return React.lazy(async () => fetchComponent(name))
  }, [name])

  return (
    <Suspense
      fallback={
        <div style={{alignItems: 'center', justifyContent: 'center', flex: 1}}>
          <span style={{fontSize: 50}}>Loading...</span>
        </div>
      }>
      <Component {...props}>{children}</Component>
    </Suspense>
  )
}

export default React.memo(DynamicComponent)
```

这里使用到了 React 中的 `Suspense` 组件和 `React.lazy` 方法，关于他们的用法这里不做过多解释，整个 `DynamicComponent` 组件的含义是远程加载目标组件，这个过程该组件会渲染传入 `Suspense` 参数 `fallback` 之中的内容，最后会使用加载成功的组件进行替换。接下来看看 `fetchComponent` 是如何实现的：

```js
const fetchComponent = async (name) => {
  const text = await fetch(
    `http://127.0.0.1:8080/${name}.js?ts=${Date.now()}`
  ).then((a) => {
    if (!a.ok) {
      throw new Error('Network response was not ok')
    }
    return a.text()
  })
  const module = getParsedModule(text, name)
  return {default: module.exports}
}
```

该方法会发起网络请求得到组件的代码，并交给 `getParsedModule` 去解析，最后得到模块返回。我们来看一下 `getParsedModule` 是怎么实现的：

```js
const packages = {
  react: React,
}

const getParsedModule = (code) => {
  let module = {
    exports: {},
  }
  const require = (name) => {
    return packages[name]
  }
  Function('require, exports, module', code)(require, module.exports, module)
  return module
}
```

这里使用 `Function` 来运行传入的代码，因为打包远程组件的时候并没有将 `react` 库打包进去，所以这里需要实现 `require` 这个方法。

我们结合之前打包得到的 `Button.js` 来看这段代码，它其实同下面这个代码是等价的：

```js
const packages = {
  react: React,
}

const getParsedModule = (code, moduleName) => {
  let module = {
    exports: {},
  }
  const require = (name) => {
    return packages[name]
  }
  ;((require, exports, module) => {
    'use strict'

    var React = require('react')

    function _interopDefaultLegacy(e) {
      return e && typeof e === 'object' && 'default' in e ? e : {default: e}
    }

    var React__default = /*#__PURE__*/ _interopDefaultLegacy(React)

    var Button = function (_ref) {
      var children = _ref.children
      return /*#__PURE__*/ React__default['default'].createElement(
        'button',
        {
          style: {
            color: 'blue',
          },
        },
        children
      )
    }

    module.exports = Button
  })(require, module.exports, module)
  return module
}
```

最后我们可以按照如下方式来使用 `DynamicComponent` 组件：

```js
import DynamicComponent from './DynamicComponent'

function App() {
  return (
    <div>
      <DynamicComponent name='Button'>Click Me</DynamicComponent>
      <DynamicComponent name='Text'>Remote Component</DynamicComponent>
    </div>
  )
}

export default App
```

现在我们尝试修改远程动态组件库中的组件，重新打包后就可以马上看到修改后的效果了。

# 总结

本文介绍了一种实现远程动态组件的方式，不过比较简陋，事实上我们还有很多优化的空间。比如按照现在的实现方式，如果页面上面使用了两个 `Button`，会发起两次请求，这显然不合理。针对这个问题，我们可以通过提前加载以及模块缓存的方式来解决。
