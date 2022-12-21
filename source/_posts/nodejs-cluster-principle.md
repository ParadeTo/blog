---
title: Node.js 高级编程之 cluster
date: 2022-12-15 20:31:34
tags:
  - nodejs
categories:
  - nodejs
description: 研究下 Cluster 的实现原理
---

# 前言

日常工作中，对 Node.js 的使用都比较粗浅，趁这次 CY 之际，来学点稍微高级的，那就先从 cluster 开始吧。

鲁迅说过，“带着问题去学习是一个比较好的方法”，所以我们也来试一试。

当初使用 cluster 时，一直好奇它是怎么做到多个子进程监听同一个端口而不冲突的，比如下面这段代码：

```js
const cluster = require('cluster')
const net = require('net')
const cpus = require('os').cpus()

if (cluster.isPrimary) {
  for (let i = 0; i < cpus.length; i++) {
    cluster.fork()
  }
} else {
  net
    .createServer(function (socket) {
      socket.on('data', function (data) {
        socket.write(`Reply from ${process.pid}: ` + data.toString())
      })
      socket.on('end', function () {
        console.log('Close')
      })
      socket.write('Hello!\n')
    })
    .listen(9999)
}
```

该段代码通过父进程 `fork` 出了多个子进程，且这些子进程都监听了 9999 这个端口并能正常提供服务，这是如何做到的呢？我们来调试一下。

# 准备调试环境

学习 Node.js 官方提供库最好的方式当然是调试一下，所以，我们先来准备一下环境。注：本文的操作系统为 macOS Big Sur 11.6.6，其他系统请自行准备相应环境。

## 编译 Node.js

1. 下载 Node.js 源码

```
git clone https://github.com/nodejs/node.git
```

然后在 `lib/internal/cluster/primary.js` `queryServer` 函数中加个断点，方便后面调试用：

```js
function queryServer(worker, message) {
  debugger;
  // Stop processing if worker already disconnecting
  if (worker.exitedAfterDisconnect) return;

  ...
}
```

2. 进入目录，执行

```
./configure --debug
make -j4
```

之后会生成 `out/Debug/node`

## 准备 IDE 环境

使用 vscode 调试，配置好 `launch.json` 就可以了（其他 IDE 类似，请自行解决）：

```js
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "runtimeExecutable": "****/out/Debug/node",
      "request": "launch",
      "name": "Debug Node",
      "args": [
        "--expose-internals",
        "--nolazy",
      ],
      "skipFiles": [], // 这个不能去掉
      "program": "${workspaceFolder}/index.js"
    }
  ]
}

```

# Cluster 源码调试

准备好调试代码（为了调试而已，这里启动一个子进程就够了）：

```js
debugger
const cluster = require('cluster')
const net = require('net')

if (cluster.isPrimary) {
  debugger
  cluster.fork()
} else {
  const server = net.createServer(function (socket) {
    socket.on('data', function (data) {
      socket.write(`Reply from ${process.pid}: ` + data.toString())
    })
    socket.on('end', function () {
      console.log('Close')
    })
    socket.write('Hello!\n')
  })
  debugger
  server.listen(9999)
}
```

很明显，我们的程序可以分父进程和子进程这两部分来进行分析。

_首先进入的是父进程：_

执行 `require('cluster')` 时，会进入 `lib/cluster.js` 这个文件：

```js
const childOrPrimary = 'NODE_UNIQUE_ID' in process.env ? 'child' : 'primary'
module.exports = require(`internal/cluster/${childOrPrimary}`)
```

会根据当前 `process.env` 上是否有 `NODE_UNIQUE_ID` 来引入不同的模块，此时是没有的，所以会引入 `internal/cluster/primary` 这个模块：

```js
...
const cluster = new EventEmitter();
...
module.exports = cluster

const handles = new SafeMap()
cluster.isWorker = false
cluster.isMaster = true // Deprecated alias. Must be same as isPrimary.
cluster.isPrimary = true
cluster.Worker = Worker
cluster.workers = {}
cluster.settings = {}
cluster.SCHED_NONE = SCHED_NONE // Leave it to the operating system.
cluster.SCHED_RR = SCHED_RR // Primary distributes connections.
...
cluster.schedulingPolicy = schedulingPolicy

cluster.setupPrimary = function (options) {
...
}

// Deprecated alias must be same as setupPrimary
cluster.setupMaster = cluster.setupPrimary

function setupSettingsNT(settings) {
...
}

function createWorkerProcess(id, env) {
  ...
}

function removeWorker(worker) {
 ...
}

function removeHandlesForWorker(worker) {
 ...
}

cluster.fork = function (env) {
  ...
}
```

该模块主要是在 `cluster` 对象上挂载了一些属性和方法，并导出，这些后面回过头再看，我们继续往下调试。往下调试会进入 `if (cluster.isPrimary)` 分支，代码很简单，仅仅是 `fork` 出了一个新的子进程而已：

```js
// lib/internal/cluster/primary.js
cluster.fork = function (env) {
  cluster.setupPrimary()
  const id = ++ids
  const workerProcess = createWorkerProcess(id, env)
  const worker = new Worker({
    id: id,
    process: workerProcess,
  })

  ...

  worker.process.on('internalMessage', internal(worker, onmessage))
  process.nextTick(emitForkNT, worker)
  cluster.workers[worker.id] = worker
  return worker
}
```

`cluster.setupPrimary()`：比较简单，初始化一些参数啥的。

`createWorkerProcess(id, env)`：

```js
// lib/internal/cluster/primary.js
function createWorkerProcess(id, env) {
  const workerEnv = {...process.env, ...env, NODE_UNIQUE_ID: `${id}`}
  const execArgv = [...cluster.settings.execArgv]

  ...

  return fork(cluster.settings.exec, cluster.settings.args, {
    cwd: cluster.settings.cwd,
    env: workerEnv,
    serialization: cluster.settings.serialization,
    silent: cluster.settings.silent,
    windowsHide: cluster.settings.windowsHide,
    execArgv: execArgv,
    stdio: cluster.settings.stdio,
    gid: cluster.settings.gid,
    uid: cluster.settings.uid,
  })
}
```

可以看到，该方法主要是通过 `fork` 启动了一个子进程来执行我们的 `index.js`，且启动子进程的时候设置了环境变量 `NODE_UNIQUE_ID`，这样 `index.js` 中 `require('cluster')` 的时候，引入的就是 `internal/cluster/child` 模块了。

`worker.process.on('internalMessage', internal(worker, onmessage))`：监听子进程传递过来的消息并处理。

_接下来就进入了子进程的逻辑：_

前面说了，此时引入的是 `internal/cluster/child` 模块，我们先跳过，继续往下，看下 `server.listen(9999)` 做了啥：

```js
// lib/net.js
Server.prototype.listen = function (...args) {
  ...
      listenInCluster(
        this,
        null,
        options.port | 0,
        4,
        backlog,
        undefined,
        options.exclusive
      );
}
```

可以看到，最终是调用了 `listenInCluster`：

```js
// lib/net.js
function listenInCluster(
  server,
  address,
  port,
  addressType,
  backlog,
  fd,
  exclusive,
  flags,
  options
) {
  exclusive = !!exclusive

  if (cluster === undefined) cluster = require('cluster')

  if (cluster.isPrimary || exclusive) {
    // Will create a new handle
    // _listen2 sets up the listened handle, it is still named like this
    // to avoid breaking code that wraps this method
    server._listen2(address, port, addressType, backlog, fd, flags)
    return
  }

  const serverQuery = {
    address: address,
    port: port,
    addressType: addressType,
    fd: fd,
    flags,
    backlog,
    ...options,
  }
  // Get the primary's server handle, and listen on it
  cluster._getServer(server, serverQuery, listenOnPrimaryHandle)

  function listenOnPrimaryHandle(err, handle) {
    err = checkBindError(err, port, handle)

    if (err) {
      const ex = exceptionWithHostPort(err, 'bind', address, port)
      return server.emit('error', ex)
    }

    // Reuse primary's server handle
    server._handle = handle
    // _listen2 sets up the listened handle, it is still named like this
    // to avoid breaking code that wraps this method
    server._listen2(address, port, addressType, backlog, fd, flags)
  }
}
```

由于是在子进程中执行，所以最后会调用 `cluster._getServer(server, serverQuery, listenOnPrimaryHandle)`：

```js
// lib/internal/cluster/child.js
// 这里的 cb 就是上面的 listenOnPrimaryHandle
cluster._getServer = function (obj, options, cb) {
  ...
  send(message, (reply, handle) => {
    debugger
    if (typeof obj._setServerData === 'function') obj._setServerData(reply.data)

    if (handle) {
      // Shared listen socket
      shared(reply, {handle, indexesKey, index}, cb)
    } else {
      // Round-robin.
      rr(reply, {indexesKey, index}, cb)
    }
  })

  ...
}
```

该函数最终会向父进程发送 `queryServer` 的消息，父进程处理完后会调用回调函数，最终调用 `listenOnPrimaryHandle`。看来，`listen` 的逻辑是在父进程中进行的了。

_接下来进入父进程：_

# 两种模式的对比

```js
// cluster.js
const cluster = require('cluster')
const net = require('net')

if (cluster.isMaster) {
  for (let i = 0; i < 4; i++) {
    cluster.fork()
  }
} else {
  const server = net.createServer()
  server.on('connection', (socket) => {
    console.log(`PID: ${process.pid}!`)
  })
  server.listen(9997)
}
```

```js
const net = require('net')
for (let i = 0; i < 20; i++) {
  net.connect({port: 9997})
}
```

_RoundRobin_

```js
PID: 42904!
PID: 42906!
PID: 42905!
PID: 42904!
PID: 42907!
PID: 42905!
PID: 42906!
PID: 42907!
PID: 42904!
PID: 42905!
PID: 42906!
PID: 42907!
PID: 42904!
PID: 42905!
PID: 42906!
PID: 42907!
PID: 42904!
PID: 42905!
PID: 42906!
PID: 42904!
```

_Shared_

`NODE_CLUSTER_SCHED_POLICY=none node cluster.js`

```js
PID: 42561!
PID: 42562!
PID: 42561!
PID: 42562!
PID: 42564!
PID: 42561!
PID: 42562!
PID: 42563!
PID: 42561!
PID: 42562!
PID: 42563!
PID: 42564!
PID: 42564!
PID: 42564!
PID: 42564!
PID: 42564!
PID: 42563!
PID: 42563!
PID: 42564!
PID: 42563!
```
