---
title: 自己手写一个 promise
date: 2018-08-02 09:53:46
tags:
- promise
categories:
- javascript
description: 一步一步实现一个 promise
---

> 本文代码参考 https://tech.meituan.com/promise_insight.html
> 主要是为了分析实现一个 promise 的步骤

# 乞丐版
话不多说，一个最简单的 `Promise` 很简单就出来了：

```javascript
function YouPromise (fn) {
  const deferreds = []

  this.then = function (onFulfilled) {
    deferreds.push(onFulfilled)
    return this
  }

  function resolve (value) {
    deferreds.forEach(function (deferred) {
      deferred(value)
    })
  }

  fn(resolve)
}

module.exports = YouPromise
```

测试一下：

```javascript
it('support chain', cb => {
  let times = 0
  new YouPromise((resolve) => {
    setTimeout(() => {
      resolve()
      expect(times).toBe(2)
      cb()
    }, 10)
  })
    .then(() => times++)
    .then(() => times++)
})
```

但是一旦传入 `YouPromise` 的函数里面 `resolve` 是同步执行的话，问题就来了。因为 `resolve` 先于 `then` 执行，而 `resolve` 执行时 `deferreds` 数组中还没有函数，而等到 `then` 里面的函数放到数组中时，`resolve` 都已经执行完了，这些函数也就没有机会再执行了。所以，下面的测试用例会报错

```javascript
it('support promise synchronous', cb => {
  let times = 0
  new YouPromise((resolve) => {
    resolve()
  })
    .then(() => times++)
    .then(() => times++)
    .then(() => {
      expect(times).toBe(2)
      cb()
    })
})
```

# 支持同步 resolve
为了解决上面的问题，我们可以想到在 `YouPromise` 中，将 `resolve` 中的代码延迟执行：

```javascript
function resolve (value) {
  setTimeout(() => {
    deferreds.forEach(function (deferred) {
      deferred(value)
    })
  }, 0)
}
```

这样，就解决了上面的问题。不过，现在的 `YouPromise` 有个问题是，在 `resolve` 执行完之后使用 `then` 加入的函数不会执行，但是标准的 `Promise` 是可以的，比如下面这样：

```javascript
it('can call then after promise resolve', cb => {
  let times = 0
  const p = new Promise((resolve, reject) => {
    resolve()
  })

  p.then(() => {
    times++
  })

  setTimeout(() => {
    p.then(() => {
      times++
      expect(times).toBe(2)
      cb()
    })
  }, 100)
})
```

把上面的 `Promise` 替换成 `YouPromise` 则测试用例无法通过。

# 支持 resolve 后还能执行 then
为了支持 `resolve` 后还能执行 `then` 里面的函数，我们需要引入状态的概念：

```javascript
function YouPromise (fn) {
  let value = null
  let state = 'pending'
  const deferreds = []

  this.then = function (onFulfilled) {
    if (state === 'pending') {
      deferreds.push(onFulfilled)
      return this
    }
    onFulfilled(value)
    return this
  }

  function resolve (newValue) {
    value = newValue
    state = 'fulfilled'
    setTimeout(() => {
      deferreds.forEach(function (deferred) {
        deferred(value)
      })
    }, 0)
  }

  fn(resolve)
}
```

一个 `YouPromise` 对象的状态初始化为 pending, 当其状态为 pending 时调用 `then` 会继续往 `deferreds` 数组中存放函数，否则说明该对象已经 fulfilled 了，可以直接执行 `then` 传入的函数。`resolve` 会将该对象的状态置为 fulfilled。现在再运行上面的测试用例就没问题了。

# then 传递结果
为了支持 `then` 中返回的数据可以传递到下一个 `then`，我们的代码要稍作改动：

```javascript
function resolve (newValue) {
  value = newValue
  state = 'fulfilled'
  setTimeout(() => {
    deferreds.forEach(function (deferred) {
      value = deferred(value)
    })
  }, 0)
}
```

这样，下面的测试用例就可以顺利通过啦：

```javascript
const p1 = new Promise((resolve) => {
  setTimeout(() => {
    resolve(1)
  }, 10)
})

p1
  .then(val => {
    expect(val).toBe(1)
    return 2
  })
  .then(val => {
    expect(val).toBe(2)
    cb()
  })
```

# 串行 promise
接下来就是我们最难的功能了，我们想串行化 `promise`，比如像下面这样：

```javascript
  let user = {}
  function getUserId () {
    return new YouPromise((resolve, reject) => {
      setTimeout(() => {
        user.id = 9876
        resolve(9876)
      }, 10)
    })
  }

  function getUserMobileById (id) {
    return new YouPromise((resolve, reject) => {
      setTimeout(() => {
        expect(id).toBe(9876)
        user.mobile = '18611110000'
        resolve(user)
      }, 20)
    })
  }

  function printUser (user) {
    console.log(user)
  }

  getUserId()
    .then(getUserMobileById)
    .then(printUser)
```

首先，直接把代码贴出来，然后我们再分析一下这个例子：

```javascript
function YouPromise (fn) {
  let value = null
  let state = 'pending'
  const deferreds = []

  this.then = function (onFulfilled) {
    return new YouPromise(function (resolve) {
      handle({
        onFulfilled: onFulfilled || null,
        resolve: resolve
      })
    })
  }

  function handle (deferred) {
    if (state === 'pending') {
      deferreds.push(deferred)
      return
    }

    var ret = deferred.onFulfilled(value)
    deferred.resolve(ret)
  }

  function resolve (newValue) {
    if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
      var then = newValue.then
      if (typeof then === 'function') {
        then.call(newValue, resolve)
        return
      }
    }
    state = 'fulfilled'
    value = newValue
    setTimeout(function () {
      deferreds.forEach(function (deferred) {
        handle(deferred)
      })
    }, 0)
  }

  fn(resolve)
}
```

1. `getUserId()` 生成了一个 promise，我们把它叫做 promiseUserId, `promiseUserId.then(getUserMobileById)` 返回了一个新的 promise，这个 promise 我们把它叫做 promiseBridge1，意思就是作为一个桥梁，连接两个 promise。后面那个 `.then(printUser)` 的调用者，自然就是 promiseBridge1 了，这里又会生成一个 promise，我们叫它 promiseBridge2。两个 `then` 执行完后，此时各 promise 的状态如下所示：
  ```javascript
  promiseUserId: {
    value: null,
    state: 'pending',
    deferreds: [{
      onFulfilled: getUserMobileById,
      resolve: resolve // 这里的 resolve 是属于 promiseBridge1 的
    }]
  }

  promiseBridge1: {
    value: null,
    state: 'pending',
    deferreds: [{
      onFulfilled: printUser,
      resolve: resolve // 这里的 resolve 是属于 promiseBridge2 的
    }]
  }
  ```
2. 10 毫秒后 promiseUserId 执行 `resolve`，会依次将 `deferreds` 中的数据放到 `handle` 中执行，该函数中首先执行 `deferred.onFulfilled(value)` 方法，即 `getUserMobileById`，返回的 `ret` 为一个 promise，我们叫它 promiseUserMobile。

3. 然后执行 `deferred.resolve(ret)`。我们看 `resolve` 方法，此时 `newValue` 即为 promiseUserMobile，`if` 中的判断生效，我们调用 promiseUserMobile 的 `then` 方法，并将 `resolve` 作为回调函数传入，这里的 `resolve` 仍然是属于 promiseBridge1 的，同时直接返回。这样就必须等到 promiseUserMobile `resolve` 后才能再次执行 promiseBridge1 的 `resolve` 方法了。此时 promiseUserMobile 的状态如下：
  ```javacript
  promiseBridge1: {
    value: null,
    state: 'pending',
    deferreds: [{
      onFulfilled: resolve, // 这里的 resolve 是这段代码传入的 then.call(newValue, resolve) 属于 promiseBridge1
      resolve: resolve // 这是另外一个 bidgePromise 的 resolve 了
    }]
  }
  ```


4. 20 毫秒后 promiseUserMobile 执行 `resolve` 方法，此时会依次将 `deferreds` 中的数据放到 `handle` 中执行，最终会执行到 promiseBridge1 的 `resolve`。

5. 再次执行到 promiseBridge1 的 `resolve` 时，此时 `newValue` 是 `user` 对象，则会执行 `if` 后面的流程，最终会执行 `printUser`。
