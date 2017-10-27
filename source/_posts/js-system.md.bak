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

1. Zepto流程
```javascript

var Zepto = (function() {

  $ = function(selector, context) {
    return zepto.init(selector, context)
  }

  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }

  zepto.Z = function(dom, selector) {
    return new Z(dom, selector)
  }

  zepto.init = function(selector, context) {
    ...
    return zepto.Z(dom, selector)
  }


  $.fn = {
    constructor: zepto.Z,
    ...
  }

  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
```

2. eq和get的区别

`$('li')` 返回的是一个`Z`对象，这个对象是像这样子的：

```
{0: li, 1: li, length: 2, selector: 'li'}
```

`$('li').get(0)` 等价于 `$('li')[0]`, 返回的是dom对象

```javascript
get: function(idx){
  return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
},
```

`$('li').eq(0)`返回的是`Z`对象

```javascript
eq: function(idx){
  return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
},

slice: function(){
  return $(slice.apply(this, arguments))
},
```

3. css方法

```javascript
css: function(property, value){
  // 取值
  if (arguments.length < 2) {
    // 只返回第一个元素的属性值
    var element = this[0]
    if (typeof property == 'string') {
      if (!element) return
      // 转为驼峰表示
      // getComputedStyle(element, '') 得到元素的样式表对象，只读，第二个参数是伪类
      // getPropertyValue(property) 得到属性-连接的形式
      return element.style[camelize(property)] || getComputedStyle(element, '').getPropertyValue(property)
    } else if (isArray(property)) {
      // 得到多个属性，返回一个对象
      if (!element) return
      var props = {}
      var computedStyle = getComputedStyle(element, '')
      $.each(property, function(_, prop){
        props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
      })
      return props
    }
  }

  // 赋值
  var css = ''
  if (type(property) == 'string') {
    if (!value && value !== 0)
      // 去掉原来的属性值
      this.each(function(){ this.style.removeProperty(dasherize(property)) })
    else
      css = dasherize(property) + ":" + maybeAddPx(property, value)
  } else {
    for (key in property)
      if (!property[key] && property[key] !== 0)
        this.each(function(){ this.style.removeProperty(dasherize(key)) })
      else
        css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
  }
  // 新的样式追加到cssText的后面
  return this.each(function(){ this.style.cssText += ';' + css })
},
```




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


# 事件
## 通用事件绑定

```javascript
function addHandler(ele,type,handler){
  if(ele.addEventListener){
    ele.addEventListener(type,handler,false);
  } else if (ele.attachEvent) {
    ele.attachEvent('on'+type,handler);
  } else {
    ele['on'+type] = handler;
  }
}

function removeHandler(ele,type,handler){
 if(ele.removeEventListener){
   ele.removeEventListener(type,handler,false);
 } else if (ele.attachEvent) {
   ele.detachEvent('on'+type,handler);
 } else {
   ele['on'+type] = null;
 }
}


function bindEvent (elem, type, selector, fn) {
  if (fn == null) {
    fn = selector
    selector = null
  }

  elem.addEventListener(type, function (e) {
    var target
    if (selector) {
      target = e.target
      if (target.matches(selector)) {
        fn.call(target, e)
      }
    } else {
      fn(e)
    }
  })
}
```

## 事件冒泡

## 代理

```javascript
ele.matches('.list')
```

## 题目

* 编写一个通用的事件监听函数

* 冒泡流程

  1. DOM是树形结构

# ajax

## XMLHttpRequest
```javascript
var xhr = new XMLHttpRequest()
xhr.open("GET", "/api", true)
xhr.onreadystatechange = function () {
  if (xhr.readyState == 4) {
    if (xhr.status == 200) {
      alert(xhr.responseText)
    }
  }
}
xhr.send(null)
```

0 - 还没有调用send方法

1 - 已调用send方法，正在发送请求

2 - send方法执行完成，已经接收到全部响应内容

3 - 正在解析响应内容

4 - 响应内容解析完成，可以在客户端调用了




# 跨域

* 协议、域名、端口

* 可跨域
  * img
  * link
  * script


## jsonp
下面是我实现的一个jsonp的简单例子

前端代码：

```javascript
  <script>
    function myFunc( data ) {
      console.log(data)
    }
  </script>
  <script src="http://localhost:3000/api/jsonp/?func=myFunc"></script>
```

后端代码：

```javascript

  // 拿到前端的函数名
  var func = req.query.func
  data = '我是数据'
  // 返回 myFunc("我是数据") 给前端
  res.status(200).send(func + '("' + data + '")')

```

前端得到后端返回的数据后会开始解析执行，然后就得到了后端返回的数据了

# 存储

* cookie： 4kb ajax会携带
* storage： 5mb

# 开发环境

## git

## 模块化

不使用时的问题：

```javascript
<script src="util.js"></script>
<script src="a-util.js"></script>
<script src="a.js"></script>
```

1. 全局变量污染
2. a.js知道要引用a-utils.js，但是他不知道要依赖util.js


### AMD

### commonjs

# 运行环境
## 加载资源的形式
* 输入url加载html
* 加载静态资源

## 加载资源的过程

1. 浏览器根据DNS得到域名的ip地址
2. 向这个ip的机器发送http请求
3. 服务器收到、处理并返回http请求
4. 浏览器得到返回内容

## 渲染页面的过程

1. 根据html结构生成DOM tree
2. 根据CSS生成CSSOM
3. 将DOM和cssom整合形成RenderTree
4. 根据RenderTree开始渲染和展示
5. 遇到script时，会执行并阻塞渲染

## 题目

* 输入url到html的详细过程

* window.onload 和 DOMContentLoaded 的区别

  onload: 所有的都加载完

  DOMContentLoaded: dom渲染完，可能图片和视频还没有加载完


# 性能优化

* 加载页面和静态资源优化

  * 静态资源的合并压缩
  * 静态资源缓存
  * 使用CDN让资源加载更快
  *

* 页面渲染优化

  * css放前面，js放后面
  * 懒加载
  * 减少DOM查询，查询的结果做个缓存
  * 减少dom操作，使用documentFragment
  * 事件节流


# 安全性

* XSS


* CSRF  

# 面试技巧

* 简历
  突出项目经历和解决方案


* 过程中......

  缺点：目前正在学的东西
