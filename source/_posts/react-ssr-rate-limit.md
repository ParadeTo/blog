---
title: React SSR 之限流
date: 2022-07-07 10:00:29
tags:
  - react
  - ssr
categories:
  - javascript
description: 讨论 React 服务端渲染限流的问题
---

# 引言

当对 React 应用进行页面加载或 SEO 优化时，我们一般会想到用 React SSR。但 React SSR 毕竟涉及到了服务端，有很多服务端特有的问题需要考虑，而限流就是其中之一。
所谓限流，就是当我们的服务资源有限、处理能力有限时，通过对请求或并发数进行限制从而保障系统正常运行的一种策略。本文会通过一个简单的案例来说明，为什么服务端需要进行限流，并介绍一种限流算法。

# 为什么要限流

如下所示是一个简单的 nodejs 服务端项目：

```javascript
const express = require('express')

const app = express()

app.get('/', async (req, res) => {
  // It will use lots of memory resources
  const buf = Buffer.alloc(1024 * 1024 * 200, 'a')
  res.end('end')
})

app.get('/another', async (req, res) => {
  res.end('another api')
})

const listener = app.listen(process.env.PORT || 2048, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
```

其中，我们通过 `Buffer` 来模拟 SSR 过程会大量的占用内存的情况。

然后，通过 `docker build -t ssr .` 指定将我们的项目打包成一个镜像，并通过以下命令运行一个容器：

```bash
docker run \
-it \
-m 512m \ # Limit Container's Memory
--rm \
-p 2048:2048 \
--name ssr \
--oom-kill-disable \
ssr
```

我们将容器内存限制在 512m，并通过 `--oom-kill-disable` 指定容器内存不足时不关闭容器。

接下来，我们通过 `autocannon` 来进行一下压测：

```
autocannon -c 10 -d 1000 http://localhost:2048
```

通过，`docker stats` 可以看到容器的运行情况：

```
CONTAINER ID   NAME      CPU %     MEM USAGE / LIMIT   MEM %     NET I/O           BLOCK I/O         PIDS
d9c0189e2b56    ssr     0.00%     512MiB / 512MiB     99.99%    14.6kB / 8.65kB   41.9MB / 2.81MB   40
```

此时，容器内存已经全部被占用，服务对外失去了响应，通过 `curl -m 5 http://localhost:2048` 访问，收到了超时的错误提示：

```
curl -m 5 http://localhost:2048
curl: (28) Operation timed out after 5001 milliseconds with 0 bytes received
```

# 令牌桶算法

常见的限流算法有“滑动窗口算法”、“令牌桶算法”，我们这里讨论[“令牌桶算法”](https://en.wikipedia.org/wiki/Token_bucket)。在令牌桶算法中，存在一个桶，容量为 `burst`。该算法以一定的速率（设为 `rate`）往桶中放入令牌，超过桶容量会丢弃。每次请求需要先获取到桶中的令牌才能继续执行，否则拒绝。

根据令牌桶的定义，我们实现令牌桶算法如下：

```javascript
export default class TokenBucket {
  constructor(burst, rate) {
    this.burst = burst
    this.rate = rate
    this.lastFilled = Date.now()
    this.tokens = burst
  }

  take() {
    this.refill()

    if (this.tokens > 0) {
      this.tokens -= 1
      return true
    }

    return false
  }

  refill() {
    const now = Date.now()
    const elapse = now - this.lastFilled
    this.tokens = Math.min(
      this.burst,
      this.tokens + elapse * (this.rate / 1000)
    )
    this.lastFilled = now
  }
}
```

然后，按照如下方式使用：

```js
const tokenBucket = new TokenBucket(5, 10)
if (tokenBucket.take()) {
  // Do something
} else {
  // refuse
}
```

简单解释一下这个算法，调用 `take` 时，会先执行 `refill` 先往桶中进行填充。填充的方式也很简单，首先计算出与上次填充的时间间隔 `elapse` 毫秒，然后计算出这段时间内应该补充的令牌数，因为令牌补充速率是 `rate` 个/秒，所以需要补充的令牌数为：

```js
elapse * (this.rate / 1000)
```

又因为令牌数不能超过桶的容量，所以补充后桶中的令牌数为：

```js
Math.min(this.burst, this.tokens + elapse * (this.rate / 1000))
```

注意，这个令牌数是可以为小数的。

令牌桶算法具有以下两个特点：

1. 当外部请求的 QPS `M` 大于令牌补充的速率 `rate` 时，长期来看，最终有效的 QPS 会趋向于 `rate`。这个很好理解，拉的总不可能比吃的多。
2. 因为令牌桶可以存下 `burst` 个令牌，所以可以允许短时间的激增流量，持续的时间为：

```js
T = burst / (M - rate) // rate < M
```

可以理解为一个水池里面有 `burst` 的水量，进水的速率为 `rate`，出水的速率为 `M`，则净出水速率为 `M-rate`，所以水池中的水放空的时间 `burst / (M - rate)` 即为激增流量的持续时间。

我们改造一下之前的代码，加上限流：

```js
const express = require('express')
const TokenBucket = require('./tokenBucket.js')

const app = express()

const tokenBucket = new TokenBucket(1, 2)
app.get(
  '/',
  (req, res, next) => {
    if (!tokenBucket.take()) {
      res.writeHead(500, {
        'content-type': 'text/pain',
      })
      res.end('exceed limit')
      return
    }
    next()
  },
  async (req, res) => {
    const buf = Buffer.alloc(1024 * 1024 * 200, 'a')
    console.log(buf)
    res.end('end')
  }
)

app.get('/another', async (req, res) => {
  res.end('another api')
})

const listener = app.listen(process.env.PORT || 2048, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
```

然后继续执行之前的压测命令，可以看到此时容器运行正常：

```
CONTAINER ID   NAME      CPU %     MEM USAGE / LIMIT   MEM %     NET I/O           BLOCK I/O        PIDS
3bd5aa07a3a7   ssr     88.29%    203.1MiB / 512MiB   39.67%    24.5MB / 48.6MB   122MB / 2.81MB   40
```

虽然此时访问 `/` 路由会收到错误：

```
curl -m 5  http://localhost:2048

exceed limit
```

```
curl -m 5  http://localhost:2048/another

another api
```

由此可见，限流确实是系统进行自我保护的一个比较好的方法。
