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
## 什么是盒子模型
在网页中，一个元素占有空间的大小由几个部分构成，其中包括元素的内容（content），元素的内边距（padding），元素的边框（border），元素的外边距（margin）四个部分。这四个部分占有的空间中，有的部分可以显示相应的内容，而有的部分只用来分隔相邻的区域或区域。4个部分一起构成了css中元素的盒模型。

## src与href的区别


## web标准和w3c的理解和认识
* 标签闭合、小写
* 建议使用外链css和js脚本，从而达到结构与行为、结构与表现的分离
* 样式与标签的分离，更合理的语义化标签，使内容能被更多的用户所访问、内容能被更广泛的设备所访问、更少的代码和组件， 从而降低维护成本、改版更方便
* 不需要变动页面内容，便可提供打印版本而不需要复制内容，提高网站易用性

## 浏览器内核

## meta viewport原理
[移动前端开发之viewport的深入理解](http://top.css88.com/archives/772)

[移动端高清、多屏适配方案](http://div.io/topic/1092)
搬过来！！！！！！！



* 一个虚拟的窗口
* width, height, initial-scale, minimum-scale, maximum-scale, user-scalable
* 比如，下面相当去创建了一个2000px宽的画布，然后塞到屏幕中显示，屏幕为了显示全，必然要进行缩小
```html
<meta name="viewport" content="width=2000px">
```


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


## 清除浮动
[张鑫旭](http://www.zhangxinxu.com/wordpress/2010/01/%E5%AF%B9overflow%E4%B8%8Ezoom%E6%B8%85%E9%99%A4%E6%B5%AE%E5%8A%A8%E7%9A%84%E4%B8%80%E4%BA%9B%E8%AE%A4%E8%AF%86/)

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

布局规则：

* 块级格式化上下文会阻止外边距叠加
* 块级格式化上下文不会重叠浮动元素
* 块级格式化上下文通常可以包含浮动
* BFC就是页面上的一个隔离的独立容器，容器里面的子元素不会影响到外面的元素。反之也如此。（所以BFC中有浮动时，为了不影响外部元素的布局，BFC计算高度时会包括浮动元素）

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
http://davidshariff.com/quiz/#

!important > 行内 > ID > 类=属性=伪类 > 标签=伪元素选择器

## css导入方式和链接方式
区别1：link是XHTML标签，除了加载CSS外，还可以定义RSS等其他事务；@import属于CSS范畴，只能加载CSS。

区别2：link引用CSS时，在页面载入时同时加载；@import需要页面网页完全载入以后加载。

区别3：link是XHTML标签，无兼容问题；@import是在CSS2.1提出的，低版本的浏览器不支持。

区别4：ink支持使用Javascript控制DOM去改变样式；而@import不支持。


# vue

# js
## 伪数组
* childNodes
* arguments

## 数组去重
* 用辅助的对象来判断
* 用set

## 斐波拉契
```javascript
var fib = (function() {
  var cache = {
    '0': 0,
    '1': 1
  }
  
  var shell = function (n) {
    if(!cache.hasOwnProperty(n)) {
      cache[n] = shell(n-1) + shell(n-2)
    }
    return cache[n]
  }
  return shell
})()

console.log(fib(3))
console.log(fib(2))
```

## 怎样添加、移除、移动、复制、创建和查找节点？
1. 创建新节点
createDocumentFragment() //创建一个DOM片段

createElement() //创建一个具体的元素

createTextNode() //创建一个文本节点

2. 添加，移除，替换，插入

appendChild() //添加

removeChild() //移除

replaceChild() //替换

insertBefore() //插入

3. 查找

getElementsByTagName() //通过标签名称

getElementsByName() //通过元素的Name属性的值

getElementById() //通过元素Id，唯一性


## 数组中查找元素位置
```javascript
function indexOf(arr, item) {

  if (Array.prototype.indexOf){

      return arr.indexOf(item);

  } else {

      for (var i = 0; i < arr.length; i++){

          if (arr[i] === item){

              return i;

          }

      }

  }     

  return -1;
}
```

## 数组求和
* reduce
* forEach
* for 循环

```javascript
function sum(arr) {
    return eval(arr.join("+"));
};
```

## 在数组 arr 末尾添加元素 item。不要直接修改数组 arr，结果返回新的数组
* 循环push
* slice浅拷贝+push
* concat

## 删除第一个元素，不要修改原数组
* slice+shift
* 循环

## match exec区别
```javascript
var someText= "web2.0 .net2.0" ;
var pattern=/(\w+)(\d)\.(\d)/g;
var outCome_exec=pattern.exec(someText);
var outCome_matc=someText.match(pattern);

outCome_exec
["web2.0", "web", "2", "0", index: 0, input: "web2.0 .net2.0"]
outCome_matc
["web2.0", "net2.0"]

```

```javascript
var someText= "web2.0 .net2.0" ;
var pattern=/(\w+)(\d)\.(\d)/;
var outCome_exec=pattern.exec(someText);
var outCome_matc=someText.match(pattern);

outCome_matc
["web2.0", "web", "2", "0", index: 0, input: "web2.0 .net2.0"]
outCome_exec
["web2.0", "web", "2", "0", index: 0, input: "web2.0 .net2.0"]
```



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
### JS性能
* 作用域，函数中缓存全局变量
* 避免不必要的属性查找，（对于过深的属性，进行缓存）
* 优化dom交互
	* createDocumentFragment
	* innerHTML
	* 事件代理
	* HTMLCollection

## 首屏、白屏时间如何计算

## h5和原生app的优缺点

## 编写h5需要注意什么

## xss和crsf的原理以及预防

## 一次完整的HTTP事务
基本流程：a. 域名解析

b. 发起TCP的3次握手

c. 建立TCP连接后发起http请求

d. 服务器端响应http请求，浏览器得到html代码

e. 浏览器解析html代码，并请求html代码中的资源

f. 浏览器对页面进行渲染呈现给用户

## 什么叫优雅降级和渐进增强

渐进增强 progressive enhancement： 针对低版本浏览器进行构建页面，保证最基本的功能，然后再针对高级浏览器进行效果、交互等改进和追加功能达到更好的用户体验。

优雅降级 graceful degradation： 一开始就构建完整的功能，然后再针对低版本浏览器进行兼容。

区别： a. 优雅降级是从复杂的现状开始，并试图减少用户体验的供给 b. 渐进增强则是从一个非常基础的，能够起作用的版本开始，并不断扩充，以适应未来环境的需要 c. 降级（功能衰减）意味着往回看；而渐进增强则意味着朝前看，同时保证其根基处于安全地带

## 线程与进程
* 进程和线程都是一个时间段的描述，是CPU工作时间段的描述，颗粒大小不同

## 减少页面加载时间的方法
* 减少http请求，合并文件
* 图片标明宽高

