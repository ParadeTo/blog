---
title: post
date: 2020-04-19 09:27:12
tags:
---

# fibonacci 演示 fiber

```javascript
// noprotect

function fib1(n) {
  if (n <= 2) {
    return 1
  } else {
    var a = fib1(n - 1)
    var b = fib1(n - 2)
    return a + b
  }
}

// https://en.wikipedia.org/wiki/Call_stack#Structure

function fib2(n) {
  var fiber = {arg: n, returnAddr: null, a: 0 /* b is tail call */}
  rec: while (true) {
    if (fiber.arg <= 2) {
      var sum = 1
      while (fiber.returnAddr) {
        fiber = fiber.returnAddr
        if (fiber.a === 0) {
          fiber.a = sum
          fiber = {arg: fiber.a - 2, returnAddr: fiber, a: 0}
          continue rec
        }
        sum += fiber.a
      }
      return sum
    } else {
      fiber = {arg: fiber.arg - 1, returnAddr: fiber, a: 0}
    }
  }
}
```

# react 没有用 requestIdlCallback，而是自己实现了

https://github.com/facebook/react/blob/eeb817785c771362416fd87ea7d2a1a32dde9842/packages/scheduler/src/Scheduler.js#L212-L222
