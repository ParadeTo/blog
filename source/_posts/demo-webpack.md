---
title: webpack初识
date: 2016-06-29 22:14:50
tags:
- webpack
categories:
- 前端工具
description: 第一次用webpack
---

## 一个例子
有这么一个项目
demo
-- index.html
-- js
  ---- scripts.js
  ---- module1.js
  ---- module2.js
其中，index.html
```
<!DOCTYPE html>
<html>
<head lang="en">
    <meta charset="UTF-8">
    <title></title>
</head>
<body>
    <h1>My Webpack Page</h1>
    <script src="js/scripts.js"></script>
</body>
</html>
```
scripts.js、module1.js、module2.js
```
// scripts.js
require('./module1.js');
require('./module2.js');

// module1.js
console.log("module1 stuff");

// module2.js
console.log("module2 stuff");
```
显然，require是nodejs里面的语言，上述代码是无效的。这就需要用到webpack了
## 安装配置webpack
```
npm init
npm install webpack --save
npm install webpack -g
```
在项目根目录下新建webpack.config.js:
```
var debug = process.env.NODE_ENV !== "production";
var webpack = require('webpack');

module.exports = {
    context: __dirname,
    devtool: debug ? "inline-sourcemap" : null,
    entry: "./js/scripts.js",
    output: {
        path: __dirname + "/js",
        filename: "scripts.min.js"
    },
    plugins: debug ? [] : [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.OccurenceOrderPlugin(),
        new webpack.optimize.UglifyJsPlugin({ mangle: false, sourcemap: false }),
    ]
};
```
在根目录下下执行webpack，得到scripts.min.js
```
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Created by Administrator on 2016/6/29 0029.
	 */
	__webpack_require__(1);
	__webpack_require__(2);


/***/ },
/* 1 */
/***/ function(module, exports) {

	/**
	 * Created by Administrator on 2016/6/29 0029.
	 */
	// module #1
	console.log("module1 stuff");

/***/ },
/* 2 */
/***/ function(module, exports) {

	/**
	 * Created by Administrator on 2016/6/29 0029.
	 */
	// module #2
	console.log("module2 stuff");

/***/ }
/******/ ]);
....
```
也可以设置NODE_ENV=production，然后在webpack，这样得到的就是压缩后的，此时将index.html中的scripts.js改成scripts.min.js，就可以在浏览器中输出预期的内容了。
## 引入jquery，并使用
```
npm install jquery -S
```
修改module1.js
```
var $ = require('jquery'); // 这里的$只在当前module下有效
$('h1').html('new text');
```
我们可以像在nodejs中使用包一样了，是不是很嗨皮？
