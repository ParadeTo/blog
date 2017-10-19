---
title: 巧用es6生成器产生质数
date: 2017-10-19 23:12:36
tags:
- es6
- 质数
categories:
- 算法
description: 巧用es6生成器产生质数
---


廖雪峰的`python`教程"函数式编程->高阶函数->filter"中利用生成器写了一个质数生成的[例子](https://www.liaoxuefeng.com/wiki/0014316089557264a6b348958f449949df42a6d3a2e542c000/001431821084171d2e0f22e7cc24305ae03aa0214d0ef29000),
我用es6的生成器也模仿了一个：

```javascript
function *oddIter() {
  var n = 1
  while (true) {
    n = n + 2
    yield n
  }
}

function *filter (it, n) {
  for (var i of it) {
    if (i % n > 0) {
      yield i
    }
  }
}

function *primes () {
  yield 2
  var it = oddIter()
  while (true) {
    var n = it.next()
    yield n.value
    it = filter(it, n.value)
  }
}

for (var i of primes()) {
  if (i < 20) {
    console.log(i)
  } else {
    break
  }
}
```

