/**
 * Created by ayou on 2017/11/3.
 */


function MyPromise(fun) {
    this.resolveFun = function () {

    }
    fun(this.resolve.bind(this))
}

MyPromise.prototype.resolve = function (val) {
    var self = this
    global[global.setImmediate ? 'setImmediate' : 'setTimeout'].call(global, function(){
        self.resolveFun(val)
　　}, 0);

}

MyPromise.prototype.then = function (resolveFun) {
    this.resolveFun = resolveFun
}

var a = new MyPromise(function (resolve) {
    // setTimeout(function () {
        resolve(2)
    // }, 2000)
})

setTimeout(() => {
    a.then((val) => {
        console.log(val)
    })
}, 1000)


// var p = new Promise((resolve) => {
//         // setTimeout(function () {
//             resolve(3)
//         // }, 2000)
//     })
// setTimeout(() => {
//     p.then((val) => {
//         console.log(val)
//     })
// }, 1000)


// p.then(console.log)
//
// const EventEmitter = require('events');
// const util = require('util')

// Promise 继承自EventEmitter
// var Promise = function () {
//   EventEmitter.call(this);
// };
// util.inherits(Promise,EventEmitter);
//
// // then方法，绑定成功、失败、进度事件
// Promise.prototype.then = function (fulfilledHandler, errorHandler, progressHandler) {
//   if (typeof fulfilledHandler === 'function') {
//     this.once('success',fulfilledHandler)
//   }
//   if (typeof errorHandler === 'function') {
//     this.once('error', errorHandler);
//   }
//   return this;
// };
//
// var Deferred = function () {
//   this.state = 'unfulfilled';
//   this.promise = new Promise();
// };
// // 触发成功事件
// Deferred.prototype.resolve = function (obj) {
//   this.state = 'fulfilled';
//   this.promise.emit('success',obj);
// };
// // 触发失败事件
// Deferred.prototype.reject = function (err) {
//   this.state = 'failed';
//   this.promise.emit('error',err);
// };
//
// function test() {
//   var defer = new Deferred();
//   setTimeout(function(){
//       defer.resolve('test')
//   },0);
//   return defer.promise;
// }
//
// test()
//   .then(function(msg){
//     console.log(msg); // test
//   })

