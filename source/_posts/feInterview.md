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
## block 和 inline 的区别
**block**

独占一行，可以设置宽高，可以设置上下边距

**inline**


## 语义化的html标签
* 正确的标签做正确的事情
* 有利于seo，权重

## html5新特性
* 不是sgml的子集
  ```<!DOCTYPE html>```
* canvas
* video audio
* webstorage
* webworker
* 标签
  `article footer header nav section`


## css3
* 选择器 last-child
  ```javascript
  nth-child nth-of-type
  ```
* 圆角
* 渐变
 ```javascript
 background-image: webkit-gradient()
```
* transition animation transform


## css 为什么要放上面js为什么要放下面
css 放上面为了防止闪跳

js 放下面为了防止阻塞


## 什么是盒子模型
在网页中，一个元素占有空间的大小由几个部分构成，其中包括元素的内容（content），元素的内边距（padding），元素的边框（border），元素的外边距（margin）四个部分。
这四个部分占有的空间中，有的部分可以显示相应的内容，而有的部分只用来分隔相邻的区域或区域。4个部分一起构成了css中元素的盒模型。

## src与href的区别
src用于替换当前元素，href用于在当前文档和引用资源之间确立联系。

## web标准和w3c的理解和认识
* 标签闭合、小写
* 建议使用外链css和js脚本，从而达到结构与行为、结构与表现的分离
* 样式与标签的分离，更合理的语义化标签，使内容能被更多的用户所访问、内容能被更广泛的设备所访问、更少的代码和组件， 从而降低维护成本、改版更方便
* 不需要变动页面内容，便可提供打印版本而不需要复制内容，提高网站易用性

## 浏览器内核
* IE: trident内核
* Firefox：gecko内核
* Safari:webkit内核
* Opera:以前是presto内核，Opera现已改用Google Chrome的Blink内核
* Chrome:Blink(基于webkit，Google与Opera Software共同开发)

## meta viewport原理

`http://blog.csdn.net/aiolos1111/article/details/51967744`

[移动前端开发之viewport的深入理解](http://top.css88.com/archives/772)

[移动端高清、多屏适配方案](http://div.io/topic/1092)
搬过来！！！！！！！
```javascript
<meta name="viewport" content="width=640,initial-scale=0.5,maximum-scale=0.5, minimum-scale=0.5,user-scalable=no">
rem = document.documentElement.clientWidth * dpr / 10

var dpr, rem, scale;
var docEl = document.documentElement;
var fontEl = document.createElement('style');
var metaEl = document.querySelector('meta[name="viewport"]');

dpr = window.devicePixelRatio || 1;
rem = docEl.clientWidth * dpr / 10;
scale = 1 / dpr;


// 设置viewport，进行缩放，达到高清效果
metaEl.setAttribute('content', 'width=' + dpr * docEl.clientWidth + ',initial-scale=' + scale + ',maximum-scale=' + scale + ', minimum-scale=' + scale + ',user-scalable=no');

// 设置data-dpr属性，留作的css hack之用
docEl.setAttribute('data-dpr', dpr);

// 动态写入样式
docEl.firstElementChild.appendChild(fontEl);
fontEl.innerHTML = 'html{font-size:' + rem + 'px!important;}';

// 给js调用的，某一dpr下rem和px之间的转换函数
window.rem2px = function(v) {
v = parseFloat(v);
return v * rem;
};
window.px2rem = function(v) {
    v = parseFloat(v);
    return v / rem;
};

window.dpr = dpr;
window.rem = rem;
```


* 一个虚拟的窗口
* width, height, initial-scale, minimum-scale, maximum-scale, user-scalable
* 比如，下面相当去创建了一个2000px宽的画布，然后塞到屏幕中显示，屏幕为了显示全，必然要进行缩小
```html
<meta name="viewport" content="width=2000px">
```

# css
## 布局
### 单列布局
#### 水平居中
* `text—align + inline-block` 需要同时设置父元素和自己
* `margin: 0 auto` 需要指定宽度
* `display: table; margin: 0 auto`
* `绝对定位`
* `flex`
#### 垂直居中
* `vertical-algin`
* `绝对定位`
* `flex`

### 多列布局
#### 左列定宽，右列自适应
* `float + margin`
* `float + overflow` 块级格式化上下文不会重叠浮动元素
* `flex`

#### 左列不定宽，右列自适应
* `float + overflow` 块级格式化上下文不会重叠浮动元素
* `flex`

#### 右列定宽，左列自适应
* 右列向右浮动，左列向左浮动同时设置负的margin-right
* `flex`

#### 两列定宽，一列自适应
* `float + margin`
* `float + overflow` 块级格式化上下文不会重叠浮动元素
* `flex`

#### 两侧定宽，中栏自适应
* `float+margin`
```
.left{width：100px;float:left;} .center{float:left;width:100%;margin-right:-200px;} .right{width:100px;float:right;}
```

* `flex`

#### 九宫格布局
* `table`
```javascript
.parent{display:table;table-layout:fixed;width:100%;}
.row{display:table-row;}
.item{display:table-cell;width:33.3%;height:200px;}
```
* `flex`

#### 多列等分
* `float`
```javascript
.parent{margin-left:-20px}/*假设列之间的间距为20px*/ .column{float:left;width:25%;padding-left:20px;box-sizing:border-box;}
```
* `flex`

#### 多列等高
* `padding+margin负边距`

## float和display：inline-block的区别
* 文档流：float元素会脱离文档流，并使得周围元素环绕这个元素。而inline-block元素仍在文档流内（不需要清楚浮动）。
* 水平位置：inline-block元素可以通过设置父元素的text-align来影响其位置
* 垂直对齐：inline-block元素沿着默认的基线对齐。浮动元素紧贴顶部。
* 空白：inline-block包含html空白节点。如果你的html代码中一系列元素每个元素之间都换行了，
当你对这些元素设置inline-block时，这些元素之间就会出现空白。而浮动元素会忽略空白节点。可设置font-size：0属性来消除
* 需要文字环绕容器，那浮动是不二选择。如果你需要居中对齐元素，inline-block是个好选择

脱离文档流3d视图：

https://www.zhihu.com/question/24529373/answer/29135021

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
* BFC就是页面上的一个隔离的独立容器，容器里面的子元素不会影响到外面的元素。
反之也如此。（所以BFC中有浮动时，为了不影响外部元素的布局，BFC计算高度时会包括浮动元素）

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

## 水平居中
1. 行内: text-align: center
2. 块状: margin auto
3. 不定宽块状: 父元素设置  position:relative  和  left:50%，子元素设置  position:relative  和  left:50%

## 垂直居中的方法
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

区别4：link支持使用Javascript控制DOM去改变样式；而@import不支持。


# vue
## 优化
### 模板优化
1. v-show v-if
2. 少写表达式，封装到一个方法中
3. key
### script
1. 用好computed， 缓存

### 组件优化


## vue响应式原理
1. data中的每一个数据，利用了defineProperty，定义了setter和getter，在getter中通过Dep.depend()收集依赖
在setter中通过Dep.notify()来触发watcher的更新

2. 编译模板，对表达式求值，触发data的getter方法，把更新视图的回调函数作为watcher的update

## vue-router原理
1. install
  * mixin beforeCreate
  * $router $route
  * component RouterView RouterLink

2. 实例化
  * this.matcher = createMatcher(options.routes || [], this)
  * const { pathList, pathMap, nameMap } = createRouteMap(routes)
    可以看出主要做的事情就是根据用户路由配置对象生成普通的根据 path 来对应的路由记录以及根据 name 来对应的路由记录的 map，方便后续匹配对应。

  * History

3. 实例化vue
```javascript
调用 beforeCreate
this._router.init(this)
transitionTo
listen
```

## vue-router 优化
1. 懒加载

## vue对比其他框架
**vs react**

* 使用 virtual DOM
* react 丰富的生态
* react 通过 shouldComponentUpdate 来优化时不如 vue 好
* jsx vs templates
  * jsx 中可以使用JavaScript 功能来构建你的视图页面
  * templates 可能更加友好、迁移容易、甚至可以用其他模板
* 组件内的css，react 是 css in js的方案
* 方便直接集成到现有的页面中

**vs angularjs**
* angularjs1 学习曲线陡峭

## vuex 是用来做什么的
专为 Vue.js 应用程序开发的状态管理模式，
它采用集中式存储管理应用的所有组件的状态，
并以相应的规则保证状态以一种可预测的方式发生变化

**为什么需要**
1. 可以解决兄弟组件间的状态传递
2. 代码更加结构化和易维护
3. ssr一般需要


# js
## requestAnimationFrame
```apple js
(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] ||
                                      window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16.7 - (currTime - lastTime));
            var id = window.setTimeout(function() {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }
    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());
```

## task, macrotask, microtask
程序从上往下运行，遇到 task 分别将他们放到对应的队列中，然后执行 microTask 队列里的任务，然后执行 macroTask 中的任务


* macrotasks:

setTimeout

setInterval

setImmediate

requestAnimationFrame

I/O

UI rendering

* microtasks

process.nextTick

Promises // 一个构造函数，传入一个函数，返回一个对象，可以给这个对象绑定，成功的回调和失败的回调，当函数执行的状态改变时执行对应的方法
// http://www.jianshu.com/p/473cd754311f（实现！）
```

```


Object.observe

MutationObserver

```javascript
console.log('start')

const interval = setInterval(() => {
  console.log('setInterval')
}, 0)

setTimeout(() => {
  console.log('setTimeout 1')
  Promise.resolve()
    .then(() => {
      console.log('promise 3')
    })
    .then(() => {
      console.log('promise 4')
    })
    .then(() => {
      setTimeout(() => {
        console.log('setTimeout 2')
        Promise.resolve()
          .then(() => {
            console.log('promise 5')
          })
          .then(() => {
            console.log('promise 6')
          })
          .then(() => {
            clearInterval(interval)
          })
      }, 0)
    })
}, 0)

Promise.resolve()
  .then(() => {
    console.log('promise 1')
  })
  .then(() => {
    console.log('promise 2')
  })
```

## 排序
![](feInterview/sort.png)

说明：

插入排序为什么不稳定
```apple js
2213
->(第一个二换到后面去了)
1223
```


### 归并排序

### 快速排序

```javascript
function quicksort(arr, p, r) {
  if (p < r) {
    var q = partition(arr, p, r)
    quicksort(arr, p, q - 1)
    quicksort(arr, q + 1, r)
  }
}

function swap (arr, i, j) {
  var tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
}

function partition(arr, p, r) {
  x = arr[r]
  i = p - 1
  for (var j = p; j < r; j++) {
    if (arr[j] <= x) {
      i = i + 1
      swap(arr, i, j)
    }
  }
  swap(arr, i + 1, r)
  return i + 1
}

var arr = [2,3,5,1,4]
quicksort(arr, 0, arr.length - 1)
console.log(arr)
```

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

```javascript
function add (arr) {
  return new Function('arr', 'return ' + arr.join("+"))(arr)
}
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

## 对象遍历
对象构造：
```
Object.prototype.userProp = 'userProp'
Object.prototype.getUserProp = function () {
  return Object.prototype.userProp
}

var obj = {
  name: 'percy',
  [Symbol('s')]: 'symbolProp',
  unEnumerable: '不可枚举',
  getName: function () {
    return this.name
  }
}

Object.defineProperty(obj, 'unEnumerable', {
  enumerable: false
})
```


* for...in: 自身+原型链+可枚举属性
```javascript
for (let key in obj) {
  console.log(key)
}
//
name
getName
userProp
getUserProp
```

* Object.keys(): 自生+可枚举
```javascript
[ 'name', 'getName' ]
```

* Object.getOwnPropertyNames(): 自生+可枚举+不可枚举
```javascript
[ 'name', 'unEnumerable', 'getName' ]
```

* Reflect.ownKeys(obj): 自生+可枚举+不可枚举+Symbol
```javascript
[ 'name', 'unEnumerable', 'getName', Symbol(s) ]
```

* Object.getOwnPropertySymbols(): Symbol

## 随机数组
```javascript
function shuffleSort(arr) {
  for (var i = 0, len = arr.length; i < len; i++) {
    var j = Math.floor(Math.random() * (len - i))  + i
    var tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}
```

## 实现require.js的基本功能
```apple js
function require1() {
  var module = {
    exports: {}
  }
  // console.log(module.exports)
  var exports = module.exports
  //
  ;(function(module, exports) {
    // a模块的代码
    function a () {
      console.log('a')
    }
    module.exports = a
    exports.b = 1
    //
  })(module, exports)


  return module.exports
}

var obj = require1()

console.log(obj.b)
```

## 7种类型
Number, String, Boolean, Null, Undefined, Object, Symbol

## typeof能得到哪些类型
string, number, object, undefined, boolean, function, symbol

## react的setState

## 对react有什么了解（直接说了react中虚拟dom内部表示，mount过程源码和同步过程源码）

## amd和cmd区别，怎么了解到这些区别的，是否是去看了规范
```javascript
https://www.douban.com/note/283566440/
```

## 事件委托

## 兼容ie的事件封装

## web端cookie的设置和获取方法
* 设置
```javascript
function setCookie(c_name,value,expiredays)
{
  var exdate=new Date()
  exdate.setDate(exdate.getDate()+expiredays)
  document.cookie=c_name+ "=" +escape(value)+
  ((expiredays==null) ? "" : ";expires="+exdate.toGMTString())
}
```

## 编写一个contextmenu的插件

## 编写一个元素拖拽的插件
* 被拖动元素
```javascript
dragstart
drag
dragend
```

* 放置目标
```javascript
dragenter e.preventDefault() 后就可以放置了
dragover
drop/dragleave
```

* 传递数据
```javascript
e.dataTransfer.setData
e.dataTransfer.getData
```


## 事件模型解释

## get和post的区别
仅仅是协议上的区别

## 跨域/浏览器同源政策
### cookie
**document.domain** 子域名共享cookie

### iframe
**postMessage**
**window.name**

### ajax 跨域
#### jsonp
#### websocket
#### cors


* postMessage
```apple js
otherWindow.postMessage(message, targetOrigin, [transfer]);

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event)
{
  // For Chrome, the origin property is in the event.originalEvent
  // object.
  var origin = event.origin || event.originalEvent.origin;
  if (origin !== "http://example.org:8080")
    return;
    alert(event.data);    // 弹出"I was there!"
    alert(event.source);  // 对a.com、index.html中window对象的引用
                          // 但由于同源策略，这里event.source不可以访问window对象
  // ...
}
```

## 闭包
闭包就是能够读取其他函数内部变量的函数。由于在javascript中，只有函数内部的子函数才能读取局部变量，
所以闭包可以理解成“定义在一个函数内部的函数“。在本质上，闭包是将函数内部和函数外部连接起来的桥梁。
* 用途
1. 实现封装
2. 实现函数的缓存
3. 函数科利华
  * 参数复用
  * 延迟计算

* 坏处
1. 有内存泄漏的风险

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

* Object.seal
Object.seal() 方法可以让一个对象密封，并返回被密封后的对象。密封对象将会阻止向对象添加新的属性，
并且会将所有已有属性的可配置性（configurable）置为不可配置（false），
即不可修改属性的描述或删除属性。但是可写性描述（writable）为可写（true）的属性的值仍然可以被修改。

* Object.freeze
Object.freeze() 方法可以冻结一个对象，冻结指的是不能向这个对象添加新的属性，不能修改其已有属性的值，不能删除已有属性，
以及不能修改该对象已有属性的可枚举性、可配置性、可写性。也就是说，这个对象永远是不可变的。该方法返回被冻结的对象。

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
Object.prototype.toString.call(window) ; //[object Window] window是全局对象global
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
### 减少重绘重排
[10-ways-minimize-reflows-improve-performance](https://www.sitepoint.com/10-ways-minimize-reflows-improve-performance/)

[css trigger](https://csstriggers.com/)

### 加载优化
1. 合并css，javascript
2. 合并小图片，使用雪碧图
3. 缓存
```
Cache-Control: must-revalidate

// 每次都向服务器询问是否
Last-modified/If-Modified-Since
如果响应头中有 Last-modified 而没有 Expire 或 Cache-Control 时，浏览器会有自己的算法来推算出一个时间缓存该文件多久

Etag/If-None-Match
某些服务器不能精确得到资源的最后修改时间，这样就无法通过最后修改时间判断资源是否更新。
Last-modified 只能精确到秒。
一些资源的最后修改时间改变了，但是内容没改变，使用 Last-modified 看不出内容没有改变。
Etag 的精度比 Last-modified 高，属于强验证，要求资源字节级别的一致，优先级高。如果服务器端有提供 ETag 的话，必须先对 ETag 进行 Conditional Request。

Cache-Control: no-cache

Cache-Control: no-store // 完全不缓存
Cache-Control: no-transform
Cache-Control: public
Cache-Control: private
Cache-Control: proxy-revalidate
Cache-Control: max-age=<seconds> 或者使用 Expires
Cache-Control: s-maxage=<seconds>
```
4. 压缩css, JavaScript
5. 启用gzip

nginx

```
gzip on;
gzip_min_length 1k; //不压缩临界值，大于1K的才压缩，一般不用改
gzip_buffers 4 16k;
#gzip_http_version 1.0;
gzip_comp_level 2; // 压缩级别，1-10，数字越大压缩的越好，时间也越长，看心情随便改吧
gzip_types text/plain application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png;
gzip_vary off;
gzip_disable "MSIE [1-6]\.";
```

6. 首屏加载
* 不要外链css

* css阻塞问题
```
css加载不会阻塞DOM树的解析
css加载会阻塞DOM树的渲染
css加载会阻塞后面js语句的执行
```

```
// 页面先会出现内容，然后js阻塞了后面的css
script(src='/big.js')
link(rel='stylesheet', href='/big.css')
link(rel='stylesheet', href='/big2.css')
link(rel='stylesheet', href='/big3.css')

// 浏览器会把前面两个css文件先加载，这会阻塞dom渲染，然后加载js，这会阻塞后面的css
link(rel='stylesheet', href='/big.css')
link(rel='stylesheet', href='/big2.css')
script(src='/big.js')
link(rel='stylesheet', href='/big3.css')
```

* bigpipe
```
Transfer-Encoding: chunked

HTTP/1.1 200 OK
Content-Type: text/plain
Transfer-Encoding: chunked

7\r\n
Mozilla\r\n
9\r\n
Developer\r\n
7\r\n
Network\r\n
0\r\n
\r\n
```

7. 按需加载
* 图片懒加载


**屏幕可视窗口大小**
```javascript
window.innerHeight 标准浏览器及IE9+ || document.documentElement.clientHeight 标准浏览器及低版本IE标准模式 || document.body.clientHeight 低版本混杂模式
$(window).height()
```

**文档向上偏移距离**
```javascript
window.pagYoffset——IE9+及标准浏览器 || document.documentElement.scrollTop 兼容ie低版本的标准模式 ||　document.body.scrollTop 兼容混杂模式；
$(document).scrollTop()
```

**元素距离文档顶部**
offsetTop 元素相对第一个非static父元素的偏移距离

```javascript
function getElementTop(element) {
  var actualTop = element.offsetTop
  var current = element.offsetParent
  whilte(current!==null) {
    actualTop += current.offsetTop
    current = current.offsetParent
  }
  return actualTop
}
```

**getBoundingClientRect**

```javascript
1.
```

### JS优化
* 作用域，函数中缓存全局变量
* 避免不必要的属性查找，（对于过深的属性，进行缓存）
* 优化dom交互
	* createDocumentFragment
	* innerHTML
	* 事件代理
	* HTMLCollection
* 避免重复工作
例子：
```javascript
function addHandler(target, eventType, handler) {
  if (target.addEventListener) {

  } else {

  }
}
```

**延迟加载**
```javascript
function addHandler(target, eventType, handler) {
    if (target.addEventListener) {
      addHandler = function (target, eventType, handler) {

      }
    } else {

    }
    addHandler(target, eventType, handler)
}
```

**条件预加载**
```javascript
var addHandler = document.body.addEventListener ?
   function (target, eventType, handler) {

   } :
   ...
```

### vuejs项目优化

## 首屏、白屏时间如何计算
### 首屏
* 页面标记法，内联js来记录时间
* 图像相似度比较
* 首屏高度内图片加载法，寻找首屏区域内的所有图片
	`getBoundingClientRect`


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


# 算法
## 深度clone
```
function deepClone(obj) {
  var target

  function is(obj, type) {
    return Object.prototype.toString.call(obj) === '[object ' + type + ']'
  }

  if (!is(obj, 'Object') && !is(obj, 'Array')) {
    throw new Error('请传入对象')
  }

  function _clone(obj) {
    let _target
    if (is(obj, 'Object') || is(obj, 'Array')) {
      _target = deepClone(obj)
    } else {
      _target = obj
    }
    return _target
  }

  if (is(obj, 'Array')) {
    target = []
    for (var i = 0, len = obj.length; i < len; i++) {
      target[i] = _clone(obj[i])
    }
  } else {
    target = {}
    for (var i in obj) {
      target[i] = _clone(obj[i])
    }
  }

  return target
}
```

## 最长回文
1. 暴力法

```
function longStr (str) {
  function isHw (str) {
    return str.split('').reverse().join("") === str
  }

  var len = str.length
  var longestStr = ''
  var longestLen = 0
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len; j++) {
      subStr = str.substring(i, j + 1)
      if (isHw(subStr) && longestLen < j - i + 1) {
        longestLen = j - i + 1
        longStr = subStr
      }
    }
  }
  return longStr
}
```

2. 动态规划

```javascript
function longStr2 (str) {
  var len = str.length
  var longestStart = 0
  var longestEnd = 0
  var longestLen = 0
  var p = []
  // 初始化都不是回文
  for (var i = 0; i < len; i++) {
    p[i] = []
    for (var j = 0; j < len; j++) {
      p[i][j] = false
    }
  }

  for (var i = 0; i < len; i++) {
    var j = i
    while (j >= 0) {
      // 小于等于2的子串只需判断str[i] === str[j]
      // 否则需判断p[j + 1][i - 1]
      if (str[i] === str[j] && (i - j < 2 || p[j + 1][i - 1])) {
        p[j][i] = true
        if (longestLen < i - j + 1) {
          longestStart = j
          longestEnd = i
          longestLen = i - j + 1
        }
      }
      j--
    }
  }
  return {
    len: longestLen,
    str: str.substring(longestStart, longestEnd + 1)
  }
}
```

3. 马拉车算法暂时不懂

## 实现一个cache函数，输入一个函数返回新的函数，然后新函数只要入参一样在第二遍执行时可以最快的得到结果，也就是带有缓存效果
```javascript
function memoFunc(func) {
  var cache = {}
  return function() {
    var argstr = JSON.stringify(arguments)
    if (cache[argstr]) return cache[argstr]
    cache[argstr] = func.apply(null, arguments)
  }
}
```


# 设计模式
## 单例
```javascript
var Singleton = function (name) {
  this.name = name
  this.instance = null;
}

Singleton.prototype.getName = function () {
  return this.name
}

Singleton.getInstance = function (name) {
  if (!this.instance) {
    this.instance = new Singleton(name)
  }
  return this.instance
}
```

## 策略模式
```apple js
var S = function () {}
S.prototype.calculate = function (salary) {
  return salary * 5
}

var A = function () {}
A.prototype.calculate = function (salary) {
  return salary * 4
}

var B = function () {}
B.prototype.calculate = function (salary) {
  return salary * 3
}

var Bonus = function () {
  this.salary = null
  this.strategy = null
}

Bonus.prototype.setSalary = function (salary) {
  this.salary = salary
}

Bonus.prototype.setStrategy = function (strategy) {
  this.strategy = strategy
}

Bonus.prototype.getBonus = function () {
  return this.strategy.calculate(this.salary)
}
```

## 代理模式
代理和本体实现了同样的接口，通过请求代理来请求本体
```javascript
var myImage = (function () {
  var img = document.createElement('img')
  document.body.appendChild(img)
  return {
    setSrc: function (src) {
      img.src = src
    }
  }
})()

var proxyImage = (function () {
  var img = new Image()
  img.onload = function () {
    myImage.setSrc(this.src)
  }

  return {
    setSrc: function (src) {
      myImage.setSrc('./loading.gif')
      img.src = src
    }
  }
})()
```

## 发布订阅模式
```javascript

```

## 模板方法模式
```javascript
var PutInFridge = function () {

}


PutInFridge.prototype.open = function () {
  console.log('打开门')
}

PutInFridge.prototype.putin = function () {
  throw new Error('必须实现putin')
}

PutInFridge.prototype.close = function () {
  throw new Error('关门')
}

PutInFridge.prototype.do = function () {
  this.open()
  this.putin()
  if (this.beforeClose) {
    this.beforeClose()
  }
  this.close()
}
```

## 职责链
