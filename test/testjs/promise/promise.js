/**
 * Created by ayou on 2018/1/26.
 */

// myPromise

function Promise(executor){ //executor是一个执行器（函数）

  let _this = this // 先缓存this以免后面指针混乱

  _this.onResolvedCallbacks = []; // 存放then成功的回调
  _this.onRejectedCallbacks = []; // 存放then失败的回调

  _this.status = 'pending' // 默认状态为等待态
  _this.value = undefined // 成功时要传递给成功回调的数据，默认undefined
  _this.reason = undefined // 失败时要传递给失败回调的原因，默认undefined

  function resolve(value) { // 内置一个resolve方法，接收成功状态数据
    // 上面说了，只有pending可以转为其他状态，所以这里要判断一下
    if (_this.status === 'pending') {
      _this.status = 'resolved' // 当调用resolve时要将状态改为成功态
      _this.value = value // 保存成功时传进来的数据
      _this.onResolvedCallbacks.forEach(function(fn){ // 当成功的函数被调用时，之前缓存的回调函数会被一一调用
        fn()
      })
    }
  }

  function reject(reason) { // 内置一个reject方法，失败状态时接收原因
    if (_this.status === 'pending') { // 和resolve同理
      _this.status = 'rejected' // 转为失败态
      _this.reason = reason // 保存失败原因
      _this.onRejectedCallbacks.forEach(function(fn) {// 当失败的函数被调用时，之前缓存的回调函数会被一一调用
        fn()
      })
    }
  }

  try {
    executor(resolve, reject) // 执行执行器函数，并将两个方法传入
  } catch (e) {
    reject(e)
  }
}

// then方法接收两个参数，分别是成功和失败的回调，这里我们命名为onFulfilled和onRjected
Promise.prototype.then = function(onFulfilled, onRjected){
  let _this = this; // 依然缓存this

  // 改动then
  let promise2;
  if (_this.status === 'resolved') {
    promise2 = new Promise(function (resolve, reject) {
      // 可以凑合用，但是是有很多问题的
      try {
        let x = onFulfilled(_this.value)
        resolve(x)
      } catch (e) {
        reject(e)
      }
    })
  }

  if (_this.status === 'rejected') {
    promise2 = new Promise(function (resolve, reject) {
      // 可以凑合用，但是是有很多问题的
      try {
        let x = onRjected(_this.reason)
        resolve(x)
      } catch (e) {
        reject(e)
      }
    })
  }

  if(_this.status === 'pending'){
    promise2 = new Promise(function (resolve, reject) {
      _this.onResolvedCallbacks.push(function(){
        // 可以凑合用，但是是有很多问题的
        try {
          let x = onFulfilled(_this.value)
          resolve(x)
        } catch (e) {
          reject(e)
        }
      })

      _this.onRejectedCallbacks.push(function(){
        // 可以凑合用，但是是有很多问题的
        try {
          let x = onRjected(_this.reason)
          resolve(x)
        } catch (e) {
          reject(e)
        }
      })
    })
  }
  return promise2
}

module.exports = Promise // 导出模块，否则别的文件没法使用