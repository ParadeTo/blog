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





