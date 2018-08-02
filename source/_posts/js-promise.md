---
title: 自己手写一个 promise
date: 2018-08-02 09:53:46
tags:
- promise
categories:
- javascript
description: 一步一步实现一个 promise
---

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