---
title: 笔记-javascript高级程序设计（第3版）第10章
date: 2016-06-06 15:56:49
tags:
- javascript
categories:
- 读书笔记
description: javascript高级程序设计（第3版）第10章笔记
---
## 节点层次
### Node类型
* 12种类型
* NodeList转数组

```javascript
function convertToArray(nodes) {
	var array = null;
    try {
    	array = Array.prototype.slice.call(nodes, 0); // 针对非IE浏览器
    } catch {
    	array = new Array();
        for (var i=0, len=nodes.length; i< len; i++) {
        	array.push(nodes[i]);
        }
    }
    return array;
}
```
* 操作节点
1. appendChild
返回新增加的节点
如果传入的节点已经是文档的一部分，则相当于将节点从原来的位置转移到新位置。
2. insertBefore
3. replaceChild
4. removeChild
5. cloneNode
分深复制和浅复制

### Document类型
nodeType=9,nodeName="#document",nodeValue=null,parentNode=null,ownerDocument=null
* 子节点
html，可通过document.documentElement/childNodes[0]/firstChild访问
body，可通过document.body访问
doctype，可通过document.doctype访问
* 文档信息
title，document.title可访问<title>元素中的文本，但是无法修改
url，document.URL
domain，document.domain，可设置，但是不能设置为URL中不包含的域。可以用来解决不同子域之间互相通信的问题P256
referrer，document.referrer
* 查找元素
1. getElementById
2. getElementsByTagName
获取列表中某一项：
list.item(0)、list[0]、list.namedItem('name')、list['name']
3. getElementsByName
* 特殊集合
1. document.anchors，包含文档中所有带name特性的&lt;a&gt;元素
2. document.forms，所有form元素
3. document.images，所有img元素
4. document.links，所有带href的&lt;a&gt;元素
* DOM一致性检测
例：

```javascript
var hasXmlDom = document.implementation.hasFeature('XML','1.0');
```

### Element类型
nodeType=1,nodeName=tagName,nodeValue=null,parentNode=(Document/Element)
* HTML元素
id，title，lang，dir，className
* 特性操作
getAttribute，setAttribute，removeAttribute
getAttribute两类特殊特性：
1. css，getAttribute返回的是文本，.css返回的是对象
2. 事件处理程序，getAttribute返回代码字符串，属性访问返回的是javascript函数
* 创建元素
document.createElement('div')

### Text类型
nodeType=3,nodeName="#text",nodeValue=节点包含的文本,parentNode=Element
* 创建文本节点
document.createTextNode("<strong>Hello</strong> world!")

### DocumentFragment类型
nodeType=11,nodeName="#document-fragment",nodeValue=null,parentNode=null
避免操作dom元素时，导致浏览器反复渲染的问题：

```javascript
var fragment = document.createDocumentFragment();
```

## DOM操作技术
### 动态脚本、动态样式

```javascript
function loadScript(url) {
	var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    document.body.appendChild(script);
}
```
### 理解NodeList
动态的，每当文档结构发生变化时，就会更新，遍历nodelist时要注意

