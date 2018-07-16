---
title: 浅析 webpack 打包机制
date: 2018-07-11 11:01:36
tags:
- webpack
categories:
- javascript
description: 简单的分析一下 webpack 打包后的结果
---

# 从最基本的开始

首先，让我们从一个简单的例子开始：

```
src
  js
    constants.js
    index.js
    utils.js
  index.html
package.json
webpack.config.js
```

其中，各文件内容如下：

```javascript
// index.js
const sum = require('./utils').sum
const CONST = require('./constants')
console.log(sum(1, 2))
console.log(CONST.version)

// utils.js
exports.sum = (a, b) => {
 return a + b
}

// constants.js
module.exports = {
 version: '1.1.0'
}

// webpack.config.js
const path = require('path')
module.exports = {
 entry: './src/js/index.js',
 output: {
   filename: 'bundle.js',
   path: path.resolve(__dirname, 'dist')
 }
}

// index.html
<!DOCTYPE html>
<html lang="en">
...
<body>
<div>hello</div>
 <script src="./dist/bundle.js"></script>
</body>
</html>
```

打包出的结果经过简化后如下所示：

```javascript
// webpackBootstrap 启动函数
// modules 即为存放所有模块的数组，数组中的每一个元素都是一个函数
(function (modules) {
  // 安装后的模块缓存在该对象中
  var installedModules = {};
  // 模块加载函数，跟 node.js 中的 require 语句类似
  // moduleId 为模块在数组 modules 中的索引
  function __webpack_require__(moduleId) {
    // 如果模块已经加载过，直接从缓存中返回
    if (installedModules[moduleId])
      return installedModules[moduleId].exports;
    // 如果缓存中不存在需要加载的模块，就新建一个模块，存放在缓存中
    var module = installedModules[moduleId] = {
      i: moduleId, // 模块在数组中的索引
      l: false, // 还未加载
      exports: {} // 该模块的导出对象
    };
    // 执行模块函数
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    // 将模块标记为已加载
    module.l = true;
    // 返回该模块的导出对象
    return module.exports;
  }
  // 使用 __webpack_require__ 去加载 index 为 2 的模块，并且返回该模块导出的对象
  // __webpack_require__.s 表示该模块是启动模块
  return __webpack_require__(__webpack_require__.s = 2);
})
([
  /* 0 */
  (function (module, exports) {
    module.exports = {
      version: '1.1.0'
    }
  }),
  /* 1 */
  (function (module, exports) {
    exports.sum = (a, b) => {
      return a + b
    }
  }),
  /* 2 */
  (function (module, exports, __webpack_require__) {
    const sum = __webpack_require__(1).sum
    const CONST = __webpack_require__(0)
    console.log(sum(1, 2))
    console.log(CONST.version)
  })
]);
```

1. 打包后的结果是一个自执行函数，其参数是一个数组，存储了各个模块，每个模块就是一个函数，其参数分别为 `module`, `exports`, `__webpack_require__`，每个模块以数组下标作为模块的 id。

2. 自执行函数中定义了函数 `__webpack_require__(moduleId)`， 该函数类似于 nodejs 中的 require，其参数为模块 id，该函数首先判断模块是否已加载到 installedModules 对象之中，如果是，则直接返回缓存的结果，否则就新创建一个模块对象，并执行模块对应的函数，最后返回模块导出的内容。

3. 自执行函数最后调用 `__webpack_require__(__webpack_require__.s = 2)` 并传入了入口模块的 id，这样整个应用就跑起来了。

# 模块异步加载
假设我们的入口模块代码如下：

```javascript
import('./page1').then(page => {
 console.log(page)
})

import('./page2').then(page => {
 console.log(page)
})

import('./page3').then(page => {
 console.log(page)
})

import('./page4').then(page => {
 console.log(page)
})
```

打包后的结果：

*bundle.js*

```javascript
(function(modules) { // webpackBootstrap
  // install a JSONP callback for chunk loading
  var parentJsonpFunction = window["webpackJsonp"];
  /**
   * 从异步加载的文件中安装模块
   * @param {*} chunkIds 异步加载的文件中存放的需要安装的模块对应的 chunk id（包括自己），可以理解为所依赖的 chunk id
   * @param {*} moreModules 表示该 chunk 加载后新带来的 modules
   * @param {*} executeModules 需要执行的模块，可能为空
   */
  window["webpackJsonp"] = function webpackJsonpCallback(chunkIds, moreModules, executeModules) {

    var moduleId, chunkId, i = 0, resolves = [], result;
    for(;i < chunkIds.length; i++) {
      chunkId = chunkIds[i];
      if(installedChunks[chunkId])
        // 将 resolve 放到队列中后面统一执行
        resolves.push(installedChunks[chunkId][0]);
      // 标记该 chunk 加载成功
      installedChunks[chunkId] = 0;
    }
    // 将 chunk 中的 modules 合并到 modules 中
    for(moduleId in moreModules) {
      if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
        modules[moduleId] = moreModules[moduleId];
      }
    }
    if(parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules, executeModules);
    while(resolves.length)
      resolves.shift()();

  };

  // The module cache
  var installedModules = {};

  // objects to store loaded and loading chunks
  var installedChunks = {
    4: 0
  };

  // The require function
  function __webpack_require__(moduleId) {

    // Check if module is in cache
    if(installedModules[moduleId])
      return installedModules[moduleId].exports;

    // Create a new module (and put it into the cache)
    var module = installedModules[moduleId] = {
      i: moduleId,
      l: false,
      exports: {}
    };

    // Execute the module function
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    // Flag the module as loaded
    module.l = true;

    // Return the exports of the module
    return module.exports;
  }

 /**
  * 异步加载分割出去的chunk对应的文件
  * @param {*} chunkId 需要异步加载的 chunk 对应的 id
  */
  __webpack_require__.e = function requireEnsure(chunkId) {
   // 状态为 0 表示已经加载过
    if(installedChunks[chunkId] === 0)
      return Promise.resolve();

    // 不为 0 且不为空，表示正在加载，其实返回的是一个 Promise 对象，后面会看到
    if(installedChunks[chunkId]) {
      return installedChunks[chunkId][2];
    }

    // 通过 dom 操作插入 script 标签来异步加载 chunk 对应的 js 文件
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.charset = 'utf-8';
    script.async = true;
    script.timeout = 120000;

    // CSP 相关
    if (__webpack_require__.nc) {
      script.setAttribute("nonce", __webpack_require__.nc);
    }
    // 文件的路径由配置的 publicPath, chunkId 拼接而成
    script.src = __webpack_require__.p + "" + chunkId + ".bundle.js";
    // 异步加载超时时间
    var timeout = setTimeout(onScriptComplete, 120000);
    // 加载失败或成功的回调函数
    script.onerror = script.onload = onScriptComplete;
    function onScriptComplete() {
      // 防止 IE 中内存泄漏
      script.onerror = script.onload = null;
      clearTimeout(timeout);
      // 检查 chunk 是否加载成功，如果不成功则 reject
      var chunk = installedChunks[chunkId];
      if(chunk !== 0) {
        if(chunk) chunk[1](new Error('Loading chunk ' + chunkId + ' failed.'));
        installedChunks[chunkId] = undefined;
      }
    };
    // 返回的 promise，初始化 installedChunks[chunkId] 为 [resolve, reject, promise]
    // 什么时候 resolve ?
    var promise = new Promise(function(resolve, reject) {
      installedChunks[chunkId] = [resolve, reject];
    });
    installedChunks[chunkId][2] = promise;

    head.appendChild(script);
    return promise;
  };

  // __webpack_public_path__
  __webpack_require__.p = "dist/";

  // Load entry module and return exports
  return __webpack_require__(__webpack_require__.s = 4);
})
({
// 0 - 3 的 modules 被分割出去了
/***/ 4:
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__.e/* import() */(3).then(__webpack_require__.bind(null, 0)).then(page => {
 console.log(page)
})

__webpack_require__.e/* import() */(2).then(__webpack_require__.bind(null, 1)).then(page => {
 console.log(page)
})

__webpack_require__.e/* import() */(1).then(__webpack_require__.bind(null, 2)).then(page => {
 console.log(page)
})

__webpack_require__.e/* import() */(0).then(__webpack_require__.bind(null, 3)).then(page => {
 console.log(page)
})

/***/ })
});
```

*0.bundle.js*

```javascript
webpackJsonp([0],{

/***/ 3:
/***/ (function(module, exports) {

exports.name = 'page1'


/***/ })

});
```

1. `bundle.js` 中 modules[4] 模块中执行的 `__webpack_require__.e/* import() */(0).then(__webpack_require__.bind(null, 3)).then(...)` 可以分解为两步：其中 `__webpack_require__.e/* import() */(0)` 是异步加载 chunk, `__webpack_require__.bind(null, 3)` 为安装模块。

2. `__webpack_require__.e` 主要功能是通过 dom 操作插入 script 标签来异步加载 chunk 对应的 js 文件，新建了一个 Promise 对象 promise，并将 [resolve, reject, promise] 存在 installedChunks 中。

3. 异步加载的 chunk 会执行 `webpackJsonp` 方法，该方法中会执行 installedChunks 中存放的 resolve 方法，从而通知 modules[4] 中的代码继续执行。

整个过程可以用下图来表示：

![](1.jpeg)


# 提取公共代码

```javascript
src
  js
    components # 公用组件	
      layout.js
    utils # 公用工具模块
      utils.js
    vendor # 基础库
      react.js
      react-dom.js
    pageA.js
    pageB.js
```

有时候网站会由多个页面组成，每个页面都是一个独立的单页面应用，这些页面技术栈相同且包含相同的业务代码，如果每个页面的代码都将这些公共的部分包含进去，势必会造成：1) 相同的资源重复加载 2) 每个页面的体积太大

为了解决这个问题，可以将公共代码提取出来，具体到上面的例子，我们可能希望最终打包的结果像这样：

![](2.png)

为了实现上述要求，可以使用 CommonsChunkPlugin:

```javascript
const path = require('path')
const webpack = require('webpack')

module.exports = {
 entry: {
   pageA: path.resolve(__dirname, 'src/js/pageA.js'),
   pageB: path.resolve(__dirname, 'src/js/pageB.js')
 },
 output: {
   filename: '[name].[chunkhash:8].js',
   path: path.resolve(__dirname, 'dist'),
   publicPath: 'dist/',
   chunkFilename: '[name].js'
 },
 plugins: [
   new webpack.optimize.CommonsChunkPlugin({
     name: 'common',
     minChunks: 2
   }),
   new webpack.optimize.CommonsChunkPlugin({
     name: 'vendor',
     minChunks: ({ resource }) => (
       resource && resource.indexOf('vendor') >= 0 && resource.match(/\.js$/)
     )
   })
 ]
}
```