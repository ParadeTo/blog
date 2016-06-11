---
title: 异步编程解决方案-事件发布/订阅模式
date: 2016-06-11 22:10:25
tags:
- nodejs
- 事件
- 异步编程
categories:
- nodejs
description: 异步编程解决方案-事件发布/订阅模式用于解决雪崩问题
---
## 利用事件队列解决雪崩问题
所谓雪崩问题，就是在高访问量、大并发量的情况下缓存失效的情景，此时大量的请求同时涌入数据库中，数据库无法同时承受如此大的查询请求，进而影响网站整体的响应速度(《深入浅出nodejs》)
### 模拟数据库查询
```javascript
var num = 0;
var select = function (callback) {
    setTimeout(function() {
        num++;
        callback("test");
    },2000)
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);
/* 结果
test1
test2
test3
3
*/
```
上述代码模拟了站点刚好启动时缓存不存在，同一条sql（查询得到test）会被执行多次。
### 增加状态码以限制访问次数
```javascript
num = 0;
var status = "ready";
var select = function(callback){
    if (status === 'ready') {
        status = "pending";
        setTimeout(function() {
            num++;
            status = "ready";
            callback("test");
        })
    }
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);

/* 结果
 test1
 1
 */
```
此时，查询次数虽然限制成了1次，但是多次select语句只有第一次生效。
### 引入事件队列
```javascript
num = 0;
var events = require('events');
var proxy = new events.EventEmitter();
var status = "ready";
var select = function(callback){
    proxy.once("selected", callback);
    if (status === 'ready') {
        status = "pending";
        setTimeout(function() {
            num++;
            status = "ready";
            proxy.emit("selected","test");
        })
    }
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);

/* 结果
 test1
 test2
 test3
 1
 */
```
此时所有的select语句都得到了查询返回的数据，且查询次数为1，达到了我们的预期