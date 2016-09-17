---
title: chrome插件开发（模拟抢月饼）
date: 2016-09-13 19:59:46
tags:
- chrome插件
categories:
- javascript
description: 简单的chrome插件，模拟抢月饼
---
今天看到阿里的抢月饼事件，心血来潮写了个非常简单的chrome插件，[项目地址](https://github.com/ParadeTo/grab-mooncake-demo)

# 代码
## 抢月饼页
```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>抢月饼了</title>
  <style>
    .container {
      width:400px;
      margin:10px auto;
      text-align: center;
    }
    button {
      width:200px;
      height:40px;
      border-radius: 3px;
      background-color: gray;
      color:white;
      margin: 0 auto;
      border:0;
      color:white;
    }
    button[disabled]:hover {
      cursor:not-allowed;
    }
    button.active {
      background-color: #ffcf1d;
    }
    button.active:hover{
      cursor:pointer;
    }

  </style>
</head>
<body>
  <div class="container">
    <img src="img/mooncake.jpg" alt="月饼">
    <button id='btn' disabled="true"></button>
  </div>
  <script>
    var time = 3;
    var $btn = document.querySelector('#btn');
    function countDown(time) {
      var timer = setInterval(function() {
        if (time === 0) {
          $btn.innerHTML = '开抢';
          $btn.setAttribute("class","active");
          $btn.removeAttribute("disabled");
          clearInterval(timer);
          return;
        }
        $btn.innerHTML = time;
        time -= 1;
      },1000)
    }
    function btnClick () {
      alert('你抢到了月饼，这下糟糕了！')
    }
    window.onload = function() {
        countDown(time);
        $btn.onclick = btnClick;
    }

  </script>
</body>
</html>
```

## chrome插件
* manifest.json

```
{
    "manifest_version": 2,
    "name": "抢月饼",
    "version": "1.0",
    "description": "人生就像抢月饼，你永远不知道会发生什么",
    "content_scripts": [{
        "matches": ["*://localhost/"],
        "js": ["js/grab-mooncake.js"]
    }],
    "browser_action": {
        "default_icon": {
            "19": "img/icon19.png",
            "38": "img/icon38.png"
        }
    },
    "icons": {
        "16": "img/icon16.png",
        "48": "img/icon48.png",
        "128": "img/icon128.png"
    }
}
```

* grab-mooncake.js

```
function grabMooncake(el) {
    // 轮询
    var timer = setInterval(function() {
        if (el.classList.contains('active')) {
            fireEvent(el,'click');
            clearInterval(timer);
            return;
        }
    }, 500)
}

var fireEvent = function(element,event){
 if (document.createEventObject){
  // IE浏览器支持fireEvent方法
  var evt = document.createEventObject();
  return element.fireEvent('on'+event,evt)
 }
 else{
  // 其他标准浏览器使用dispatchEvent方法
  var evt = document.createEvent( 'HTMLEvents' );
  // initEvent接受3个参数：
  // 事件类型，是否冒泡，是否阻止浏览器的默认行为
  evt.initEvent(event, true, true);
  return !element.dispatchEvent(evt);
 }
};

var $btn = document.querySelector('#btn');
grabMooncake($btn);
```
