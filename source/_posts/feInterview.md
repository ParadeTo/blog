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
* 文档流：float元素会脱离文档流，并使得周围元素环绕这个元素。而inline-block元素仍在文档流内（不需要清楚浮动）。
* 水平位置：inline-block元素可以通过设置父元素的text-align来影响其位置
* 垂直对齐：inline-block元素沿着默认的基线对齐。浮动元素紧贴顶部。
* 空白：inline-block包含html空白节点。如果你的html中一系列元素每个元素之间都换行了，当你对这些元素设置inline-block时，这些元素之间就会出现空白。而浮动元素会忽略空白节点。可设置font-size：0属性来消除
* 需要文字环绕容器，那浮动是不二选择。如果你需要居中对齐元素，inline-block是个好选择

脱离文档流3d视图：

https://www.zhihu.com/question/24529373/answer/29135021

## display
* block： 

## 清除浮动
[张大师](http://www.zhangxinxu.com/wordpress/2010/01/%E5%AF%B9overflow%E4%B8%8Ezoom%E6%B8%85%E9%99%A4%E6%B5%AE%E5%8A%A8%E7%9A%84%E4%B8%80%E4%BA%9B%E8%AE%A4%E8%AF%86/)

[那些年我们清除过的浮动](http://www.iyunlu.com/view/css-xhtml/55.html)

[前端精选文摘：BFC 神奇背后的原理](http://www.cnblogs.com/lhb25/p/inside-block-formatting-ontext.html)(感觉讲得比较好的)

两类：
其一，通过在浮动元素的末尾添加一个空元素，设置 clear：both属性，after伪元素其实也是通过 content 在元素的后面生成了内容为一个点的块级元素；

其二，通过设置父元素 overflow 或者display：table 属性来闭合浮动，我们来探讨一下这里面的原理。

**BFC(块级格式化上下文)**

何时触发：

* float除none以外的值
* overflow除visible以外的值
* display(table-cell, table-caption, inline-block)
* position(absolute, fixed)
* fieldset元素

特性：

* 块级格式化上下文会阻止外边距叠加
* 块级格式化上下文不会重叠浮动元素
* 块级格式化上下文通常可以包含浮动

通俗地来说：创建了 BFC的元素就是一个独立的盒子，里面的子元素不会在布局上影响外面的元素，反之亦然，同时BFC任然属于文档中的普通流。

### 添加额外标签
```
<div class="wrap" id="float1">
	<h2>1）添加额外标签</h2>
	<div class="main left">.main{float:left;}</div>
	<div class="side left">.side{float:right;}</div>
	<div style="clear:both;"></div>
</div>
<div class="footer">.footer</div>
```

### 使用br标签和其自身的html属性
```
<div class="wrap" id="float2">
	<h2>2）使用 br标签和其自身的 html属性</h2>
	<div class="main left">.main{float:left;}</div>
	<div class="side left">.side{float:right;}</div>
	<br clear="all" />
</div>
<div class="footer">.footer</div>
```

### 父元素设置overflow:hidden，浮动，table

### 使用伪元素:after


## 兼容ie6的水平垂直居中
```javascript
<div id="wrap">  
    <div id="subwrap">  
        <div id="content">  
            ss<br/>  
            ss<br/>  
            ss<br/>  
            ss<br/>  
        </div>  
    </div>  
</div>

 #wrap {  
    background-color:#FFCCFF;  
    width:760px;   
    height:400px;  
    display:table; /*垂直居中因素*/  
    _position:relative; /*垂直居中因素*/  
 }  
 #subwrap {  
    text-align:center; /*水平居中因素*/  
    vertical-align:middle; /*垂直居中因素*/  
    display:table-cell; /*垂直居中因素*/  
    _position:absolute; /*垂直居中因素*/  
    _top:50%; /*垂直居中因素*/  
 }  
 #content {  
    width:200px;   
    background:#d0d0d0;    
    margin-left:auto;  /*水平居中因素*/  
    margin-right:auto; /*水平居中因素*/  
    _position:relative; /*垂直居中因素*/  
    _top:-50%; /*垂直居中因素*/  
 }  
```

# 水平居中
1. 行内: text-align: center
2. 块状: margin auto
3. 不定宽块状: 父元素设置  position:relative  和  left:50%，子元素设置  position:relative  和  left:50%

# 垂直居中的方法
1. 父元素高度确定的单行文本： heigh line-height
2. 多行文本： 父元素display: table, 本身display:table-cell + vertical-align: middle
3. 多行文本：一个多余的元素，高度与父元素高度一致，然后vertical-align: middle
4. 绝对定位法：position: absolute; top: 50%; margin-left: -100px......


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

## querySelectorAll 与 getElementsByTagName
```javascript
var ul = document.getElementById('list')
var li = ul.querySelectorAll('li')

console.log(li.length) // 3
li[0].parentNode.removeChild(li[0])
console.log(li.length) // 3
```

```javascript
var ul = document.getElementById('list')
var li = ul.getElementsByTagName('li')


console.log(li.length) // 3
li[0].parentNode.removeChild(li[0])
console.log(li.length) // 2
```

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

