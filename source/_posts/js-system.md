---
title: 慕课网-前端js基础面试技巧
date: 2017-09-02 21:03:35
tags:
- 面试
categories:
- 前端理论
description: js知识体系（慕课网-前端js基础面试技巧）
---

> 再次梳理下知识吧，最近有点懒了，玩王者农药去了


# 变量类型和计算
## 变量类型
### 值类型
变量的内存中存储的是值
### 引用类型（对象，数组，函数）
变量的内存中存储的是对象的引用
## 变量计算
### 强制类型转换
* 字符串拼接
* == 运算符
```javascript
100 == '100' // true
0 == '' // true Number('') => 0
null == undefined // true

var a = {
  valueOf: function () {
    return 1
  }
}

console.log(a == 1) // true
```
* if

```javascipt
0 => false
"" => false
undefined => false
NaN => false
null => false
```
* 逻辑运算

## 题目
* JS中使用typeof能得到的类型

string, number, object, boolean, function, undefined, symbol

* 何时使用 === 何时使用 ==

```javascript
if (obj.a == null) {
	// obj.a === null || obj.a === undefined
	// '' == null // false
	// 0 == null // false
	// false == null // false
}
```

* js中有哪些内置函数

```javascript
Object
Array
Boolean
Number
String
Function
Date
RegExp
Error
```

* js变量按照存储方式分为哪些类型，并描述特点

值类型，引用类型

* 如何理解JSON

js的一个对象


# 原型和原型链
## 原型规则和示例
* 所有的引用类型（数组，对象，函数），都可以拓展属性
* 所有的引用类型，都有`__proto__`属性
* 所有的函数都有prototype
* 所有的引用类型，`__proto__`指向构造函数的`prototype`
* 当要得到一个属性时，如果没有，会去隐`__proto__`中寻找

## 原型链
prototype本身也是一个对象，也有__proto__属性
## instanceof
沿着原型链往上找

## 题目
* 如何准确判断数组类型

```javascript
console.log(a instanceof Array)
console.log(Object.prototype.toString.call(a) === '[object Array]')
```

* 原型链继承的例子

* new 一个对象的过程

1. 创建一个对象
2. this指向
3. 执行代码，this赋值
4. 返回this

* zepto如何使用原型链

zepto设计和源码分析


# 作用域和闭包

## 执行上下文
* 全局：变量定义、函数声明
* 函数：变量定义、函数声明、this、arguments

## this
* 执行时确认，定义时无法确认
* 作为构造函数执行，this是新建的空对象
* 作为对象属性执行，this是对象
* 作为普通函数执行，this是全局对象
* call apply bind

## 作用域
* 没有块级作用域(es6)

## 作用域链

## 闭包



## 题目
* 变量提升
* this使用场景

	* 作为构造函数执行，this是新建的空对象
	* 作为对象属性执行，this是对象
	* 作为普通函数执行，this是全局对象
	* call apply bind

* 创建a标签，点击事件

  见面试题

* 理解作用域

  执行环境，每个执行环境都有一个变量对象，包括了这个环境中可以访问的数据


* 闭包应用

	* 私有变量，避免定义过多的全局变量


# 异步和单线程

## 什么异步

非阻塞

## 使用异步场景

* 需要等待，定时任务
* 网络请求，img加载
* 事件绑定

## 异步和单线程


## 题目

* 同步和异步的区别，举例

  同步会阻塞代码，异步不会

* setTimeout

* 前端使用异步的场景有哪些

# 其他基础知识
## Date
```javascript
Date.now()
var dt = new Date()
dt.getTime()
dt.getFullYear()
dt.getMonth() // 0 - 11
dt.getDate() // 1 - 31
dt.getDay()
dt.getHours()
dt.getMinutes()
dt.getSeconds()
```

## Math

## 数组api
* forEach
* every return: Boolean
* some return: Boolean
* map
* filter
* sort
* push
* pop
* shift
* unshift
* splice
* slice

## 对象api
* for...in
*

## 题目

* 获取2017-06-10格式的日期

* 获取随机数，要求是长度一致的字符串格式

```javascript
var random = Math.random()
var random += '0000000000'
var random = random.slice(0, 10)
```

* 通用forEach

```javascript
function forEach(obj, fn) {
  if (!(obj instanceof Object)) {
    throw new Error('第一个参数必须是对象')
    return
  }

  if (typeof fn !== 'function') {
    throw new Error('第二个参数必须是函数')
    return
  }

  if (obj instanceof Array) {
    obj.forEach(fn)
  } else {
    for (var k in obj) {
      fn(obj[k], k)
    }
  }
}
```

# JS-WEB-API
## DOM操作
### 获取
* getElementById
* getElementsByTagName
* getElementsByClassName
* querySelector
* querySelectorAll

## 题目
* DOM是哪种基本的数据结构

* 常用API

* attribute和property有何区别

	* attribute 修改的是标签上的内容
	* property 修改的是对象上的属性
