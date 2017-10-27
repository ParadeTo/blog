---
title: 使用 es6 生成器构建“生产-消费”模式
date: 2017-10-27 11:32:26
tags:
- es6
categories:
- javascript
description: 使用 es6 生成器构建“生产-消费”模式
---

```javascript
function *consumer() {
  var r = ''
  while (true) {
    var n = yield r
    if (!n) {
      return
    }
    console.log('[CONSUMER] Consuming ' + n)
    r = '200 OK'
  }
}

function produce(c) {
  c.next()
  n = 0
  while (n < 3) {
    n = n + 1
    console.log('[PRODUCER] Producing ' + n)
    r = c.next(n)
    console.log('[PRODUCER] Consumer return: ' + r.value)
  }
}

c = consumer()
produce(c)
```

结果：
```javascript
[PRODUCER] Producing 1
[CONSUMER] Consuming 1
[PRODUCER] Consumer return: 200 OK
[PRODUCER] Producing 2
[CONSUMER] Consuming 2
[PRODUCER] Consumer return: 200 OK
[PRODUCER] Producing 3
[CONSUMER] Consuming 3
[PRODUCER] Consumer return: 200 OK
```


