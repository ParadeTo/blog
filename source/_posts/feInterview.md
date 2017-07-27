---
title: 前端面试题汇总-持续更新
date: 2017-04-08 12:00:20
tags: 
- 面试
categories:
- 前端理论
description: 各种面试题汇总
---



# html
## meta viewport原理

# css
## float和display：inline-block的区别

## 兼容ie6的水平垂直居中

## css优先级

# vue

# js
## react的setState

## 对react有什么了解（直接说了react中虚拟dom内部表示，mount过程源码和同步过程源码）

## amd和cmd区别，怎么了解到这些区别的，是否是去看了规范

## 事件委托

## 兼容ie的事件封装

## web端cookie的设置和获取方法

## 编写一个contextmunu的插件

## 编写一个元素拖拽的插件

## 事件模型解释

## get和post的区别

## 跨域

## prototype和__proto__的关系是什么

## 闭包

## ajax如何实现、readyState五中状态的含义

## jsonp如何实现

## 作用域链

## 分别用ES5和ES6实现函数默认参数

```javascript
function log1(x, y) {
  y = y || 'world'
  console.log(x, y)
}

function log2(x, y="world") {
  console.log(x, y)
}
```

问题：当y转换为Boolean类型的值为False时，会有不合理的情况出现

```javascript
log1(1, '') // 1 'world'
log2(1, '') // 1 ''
```
## let var区别
	
* let有块级作用域
* let不存在变量提升
* 不允许重复声明
* 暂时性死区
	
```javascript
var tmp = 123;

if (true) {
  tmp = 'abc'; // ReferenceError
  let tmp;
}
```
		
## class实现私有方法

	```javascript
	const bar = Symbol('bar')

	class MyClass {
	  // 公有办法
	  foo(baz) {
	    this[bar](baz)
	  }
	
	  // 私有方法
	  [bar](baz) {
	    console.log(baz)
	  }
	}
	```

## const 定义的对象，能够添加属性吗？

	可以，如果要实现不能添加属性，可以用``Object.freeze()`` 
    
## 利用Set对数组去重

	```javascript
	[...new Set(array)]
	//
	Array.from(new Set(array))
	```
## Javascript的对象有什么缺点？为什么需要Map?
	
	``{}``只能用字符串作为键。

## Js类型判断

* typeof：可以准确判断出基础类型，引用类型都``object``
* instanceof: ``[] instanceof Object // true``。只能判断两个对象是否属于原型链的关系，不能获取对象的具体类型
* constructor: null和undefined是无效的对象，没有constructor；重写prototype后，原有的constructor会丢失

```javascript
function F(){}
new F().constructor === F
true
F.prototype.constructor === F
true
```

	
* Object.prototype.toString

```javascript
Object.prototype.toString.call('') ;   // [object String]
Object.prototype.toString.call(1) ;    // [object Number]
Object.prototype.toString.call(true) ; // [object Boolean]
Object.prototype.toString.call(undefined) ; // [object Undefined]
Object.prototype.toString.call(null) ; // [object Null]
Object.prototype.toString.call(new Function()) ; // [object Function]
Object.prototype.toString.call(new Date()) ; // [object Date]
Object.prototype.toString.call([]) ; // [object Array]
Object.prototype.toString.call(new RegExp()) ; // [object RegExp]
Object.prototype.toString.call(new Error()) ; // [object Error]
Object.prototype.toString.call(document) ; // [object HTMLDocument]
Object.prototype.toString.call(window) ; //[object global] window是全局对象global
```
# nodejs
## 包管理
### a.js 和 b.js 两个文件互相 require 是否会死循环? 双方是否能导出变量? 如何从设计上避免这种问题?

```javascript
function require(...) {
  var module = { exports: {} };
  ((module, exports) => {
    // Your module code here. In this example, define a function.
    function some_func() {};
    exports = some_func;
    // At this point, exports is no longer a shortcut to module.exports, and
    // this module will still export an empty default object.
    module.exports = some_func;
    // At this point, the module will now export some_func, instead of the
    // default object.
  })(module, module.exports);
  return module.exports;
}
```

假设a.js先启动，a.js如果没有执行完，则exports就是``{}``在 b.js的开头拿到的就是``{}``而已.

### 全局安装VS本地安装
* http://www.cnblogs.com/chyingp/p/npm-install-difference-between-local-global.html

# http
## accept是什么，怎么用

## http协议状态码，302和303的区别

## 前端缓存如何实现、etag如何实现、etag和cache-control的max-age的优先级哪个比较高以及为什么、cache-control和expire优先级哪个比较高以及为什么

# 其他
## 域名收敛是什么

## 前端优化策略列举

## 首屏、白屏时间如何计算

## h5和原生app的优缺点

## 编写h5需要注意什么

## xss和crsf的原理以及预防

