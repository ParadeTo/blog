---
title: nodejs之模块机制
date: 2017-06-06 22:44:53
tags:
- nodejs
categories:
- nodejs
description: 关于nodejs的模块机制
---

# CommonJS规范
**模块引用**

```javascript
var math = require('math')
```
**模块定义**

上下文提供了exports对象用于导出当前模块的方法或者变量，并且是唯一的出口。在模块中，还存在一个module对象，它代表模块自身，而exports是module的属性。将方法挂载在exports对象上作为属性即可定义导出的方式。

```javascript
exports.add = function () {}
```

**模块标识**

即传递给``require()``的参数

# Node的模块实现
引入模块需要经历如下3个步骤

1. 路径分析
2. 文件定位
3. 编译执行

模块分为两类：

1. Node提供的模块，称为核心模块：不需要文件定位和编译执行，在路径分析中优先判断，加载速度最快
2. 用户编写的模块，称为文件模块

接下来，详细展开模块加载过程

## 优先从缓存加载
Node对引入过的模块都会进行缓存，缓存的是编译和执行之后的对象。

## 路径分析和文件定位
**模块标识符分析**

主要分为以下几类（按加载速度排序）：

* 核心模块，如http、fs、path等
* .或..开始的相对路径文件模块
* 以/开始的绝对路径文件模块
* 非路径形式的文件模块，如node_modules中的模块，例如``require('express')``会依次在当前路径、上一级路径、上上级路径...的``node_modules``下去找，所以当js文件的路径越深时，该加载速度就越慢

**文件定位**

* 文件拓展名分析：``.js>.json>.node``，为了优化如果不是``.js``的文件，最好加上拓展名
* 目录分析和包：如果查找得到的是一个目录的话，会按照如下顺序：package.json(main属性指定的文件)>index.js>index.json>index.node

## 模块编译
node中，每个文件模块都是一个对象，定义如下：

```javascript
function Module(id, parent) {
	this.id = id;
	this.exports = {};
	this.parent = parent;
	if (parent && parent.children) {
		parent.children.push(this)
	}
	
	this.filename = null;
	this.loaded = false;
	this.children = [];
}
```

不同的文件拓展名，载入方式不同：

* .js文件。通过fs模块同步读取后编译执行
* .node文件。这是用C/C++编写的拓展文件，通过``dlopen()``加载编译
* .json。fs模块同步读取，``JSON.parse()``解析返回结果
* 其他。当做.js文件

**js模块的编译**

一个正常的js文件会被包装成如下样子:

```javascript
(function (exports, require, module, __filename, __dirname) {
  var math = require('math')
  exports.area = function (radius) {
    return math.PI * radius * radius
  }
})
```

执行之后，模块的``exports``属性被返回给了调用方，其上的任何方法和属性都可以被外部调用到。

# 前后端共用模块
## AMD & CMD
* [知乎](https://www.zhihu.com/question/20342350)
* [SeaJS与RequireJS最大的差别](https://www.douban.com/note/283566440/)
* [让我们再聊聊浏览器资源加载优化](http://qingbob.com/let-us-talk-about-resource-load/)

**AMD**

```javascript
require(['jquery','创建了全局变量的module'],function($,b){
	//既然我在开头明确声明依赖需求，那可以确定在执行这个回调函数时，依赖肯定是已经满足了
	//所以，放心地使用吧
})
```

实际做的事情是：

1. require函数检查依赖的模块，根据配置文件，获取js文件的实际路径
2. 根据js文件实际路径，在dom中插入script节点，并绑定onload事件来获取该模块加载完成的通知。
3. 依赖script全部加载完成后，调用回调函数

```javascript
define(function(require,exports,modules){
	var $ = require('jquery')
	$.get('http://www.zhihu.com')
	//传统JS程序员的思维：
	//“咦，好神奇，JS加载不应该是异步的么，怎么我一说要依赖，jquery就自己跳出来了？”
})
```

真相是：

1. 通过回调函数的Function.toString函数，使用正则表达式来捕捉内部的require字段，找到require('jquery')内部依赖的模块jquery
2. 根据配置文件，找到jquery的js文件的实际路径
3. 在dom中插入script标签，载入模块指定的js，绑定加载完成的事件，使得加载完成后将js文件绑定到require模块指定的id（这里就是jquery这个字符串）上
4. 回调函数内部依赖的js全部加载（暂不调用）完后，调用回调函数
5. 当回调函数调用require('jquery')，即执行绑定在'jquery'这个id上的js文件，即刻执行，并返回


都会并行加载依赖，但是AMD会解析(执行)完所有的依赖后，再执行回调函数;CMD则是在执行``require``时才会去解析(执行)，即“懒加载”。