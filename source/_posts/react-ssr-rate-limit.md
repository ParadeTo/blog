---
title: React SSR 之为什么要进行限流
date: 2022-06-12 15:24:29
tags:
  - react
categories:
  - javascript
description: 讨论 React 服务端渲染限流的问题
---

当对 React 应用进行页面加载或 SEO 优化时，我们一般绕不开 React SSR。但 React SSR 毕竟涉及到了服务端，有很多服务端特有的问题需要考虑，而限流就是其中之一。
所谓限流，就是当我们的服务资源有限、处理能力有限时，通过对请求或并发数进行限制从而保障系统正常运行的一种策略。本文会通过一个简单的案例来说明，为什么服务端需要进行限流。

如下所示是一个简单的 nodejs 服务端项目：

```javascript
const express = require('express')
const counter = require('./counter')

const app = express()

app.get('/', async (req, res) => {
  // 模拟 SSR 会大量的占用内存
  const buf = Buffer.alloc(1024 * 1024 * 200, 'a')
  console.log(buf)
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
-m 512m \ # 限制容器的内存
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
curl: (28) Operation timed out after 5001 milliseconds with 0 bytes received
```

我们改造一下代码，使用 `sliding-window-counter` 来统计 QPS，并限制为 2：

```js
const express = require('express')
const counter = require('sliding-window-counter')

const app = express()

const limit = 2
let cnt = counter(1000)
app.get(
  '/',
  (req, res, next) => {
    cnt(1)
    if (cnt() > limit) {
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

此时，容器内容占用正常：

```
CONTAINER ID   NAME      CPU %     MEM USAGE / LIMIT   MEM %     NET I/O           BLOCK I/O        PIDS
3bd5aa07a3a7   ssr     88.29%    203.1MiB / 512MiB   39.67%    24.5MB / 48.6MB   122MB / 2.81MB   40
```

虽然服务对外仍然失去了对 `/` 路由的响应，但是 `/another` 却不受影响：

```
curl -m 5  http://localhost:2048/another

another api
```

由此可见，限流确实是系统进行自我保护的一个比较好的方法。不过当 QPS 超过限流值时返回错误给用户不太好，如果此时可以降级到 CSR 就完美了，这里暂时就不讨论了。
