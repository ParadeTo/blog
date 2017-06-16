---
title: 实现一个简单的Promise/Deferred框架
date: 2016-10-10 16:31:06
tags:
- nodejs
- promise
categories:
- nodejs
description: 实现一个简单的Promise/Deferred框架
---
利用nodejs的``event``模块，可以实现一个最简单的``Promise/Deferred``框架：
# Promise
```javascript
// Promise 继承自EventEmitter
var Promise = function () {
  EventEmitter.call(this);
};
util.inherits(Promise,EventEmitter);

// then方法，绑定成功、失败、进度事件
Promise.prototype.then = function (fulfilledHandler, errorHandler, progressHandler) {
  if (typeof fulfilledHandler === 'function') {
    this.once('success',fulfilledHandler)
  }
  if (typeof errorHandler === 'function') {
    this.once('error', errorHandler);
  }
  return this;
};
```
# Deferred
```javascript
var Deferred = function () {
  this.state = 'unfulfilled';
  this.promise = new Promise();
};
// 触发成功事件
Deferred.prototype.resolve = function (obj) {
  this.state = 'fulfilled';
  this.promise.emit('success',obj);
};
// 触发失败事件
Deferred.prototype.reject = function (err) {
  this.state = 'failed';
  this.promise.emit('error',err);
};
```
# 使用方法
```javascript
function test() {
  var defer = new Deferred();
  setTimeout(function(){
      defer.resolve('test')
  },0);
  return defer.promise;
}

test()
  .then(function(msg){
    console.log(msg); // test
  })

```

# 实现链式调用
* Promise

```javascript
var Promise = function () {
  EventEmitter.call(this);
  // 队列用于存储待执行的回调函数
  this.queue = [];
  this.isPromise = true;
};
util.inherits(Promise,EventEmitter);

Promise.prototype.then = function (fulfilledHandler, errorHandler, progressHandler) {
  var handler = {};
  if (typeof fulfilledHandler === 'function') {
    handler.fulfilled = fulfilledHandler;
  }
  if (typeof errorHandler === 'function') {
    handler.error = errorHandler;
  }
  // 将then中传入的函数都添加到promise的队列中
  this.queue.push(handler);
  // then函数返回自身
  return this;
};
```
* Deferred

```javascript
var Deferred = function () {
  this.state = 'unfulfilled';
  this.promise = new Promise();
};

Deferred.prototype.resolve = function (obj) {
  var promise = this.promise;
  var handler;
  while ((handler = promise.queue.shift())) {
    if (handler && handler.fulfilled) {
      // 正常情况下，fulfilled函数会继续返回一个promise
      var ret = handler.fulfilled(obj);
      if (ret && ret.isPromise) {
        // 将当前Defferred对象的promise引用改为新的Promise对象，将队列中余下的回调转交给它
        ret.queue = promise.queue;
        this.promise = ret;
        return;
      }
    }
  }
};

Deferred.prototype.reject = function (err) {
  var promise = this.promise;
  var handler;
  while ((handler = promise.queue.shift())) {
    if (handler && handler.error) {
      var ret = handler.error(err);
      if (ret && ret.isPromise) {
        ret.queue = promise.queue;
        this.promise = ret;
        return;
      }
    }
  }
};
```
* 使用

```javascript
function test() {
  var defer = new Deferred();
  setTimeout(function(){
      defer.resolve('test1')
  },0);
  return defer.promise;
}

test()
  .then(function(msg){
    console.log(msg);
    var defer = new Deferred();
    setTimeout(function(){
            defer.resolve('test2')
    })
      return defer.promise;
  })
  .then(function(msg){
    console.log(msg)
  })
```