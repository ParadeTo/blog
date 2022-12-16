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

鲁迅说过，“带着问题去学习是一个比较好的方法”，所以我们也来试一试。

当初使用 cluster 时，一直好奇它是怎么做到多个子进程监听同一个端口而不冲突的，比如下面这段代码：

```js
const cluster = require('cluster')
const http = require('http')
const cpus = require('os').cpus()

if (cluster.isPrimary) {
  for (let i = 0; i < cpus.length; i++) {
    cluster.fork()
  }
} else {
  http
    .createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'})
      res.end('handled by child, pid is ' + cluster.worker.process.pid + '\n')
    })
    .listen(9999)
}
```

该段代码通过父进程 `fork` 出了多个子进程，且这些子进程都监听了 9999 这个端口并能正常提供服务，这是如何做到的呢？接下来就调试一下吧。

## 如何实现端口不冲突

我们给代码打上断点后，就可以开始调试了（为了调试而已，这里启动两个子进程就够了）：

```js
debugger
const cluster = require('cluster')
const http = require('http')

if (cluster.isPrimary) {
  debugger
  cluster.fork()
  cluster.fork()
} else {
  const server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.end('handled by child, pid is ' + cluster.worker.process.pid + '\n')
  })
  debugger
  server.listen(9999)
}
```

很明显，我们可以分引入 cluster，父进程（primary）和子进程（worker）这三部分来进行。

## 引入 cluster

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

该模块主要是在 `cluster` 对象上挂载了一些属性和方法，并导出，这些后面回过头再看，我们继续往下调试。

## 父进程（primary）

往下调试会进入 `cluster.fork()` 的内容，这个很重要，我们仔细研究下：

```js
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

`cluster.setupPrimary()` 比较简单，初始化一些参数啥的。

`createWorkerProcess(id, env)`：

```js
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

可以看到，该方法主要是通过 `fork` 启动了一个子进程来执行我们的 `index.js`，且启动子进程的时候设置了环境变量 `NODE_UNIQUE_ID`，这样 `index.js` 中 `require('cluster')` 的时候，引入的就是 ``

为了减轻工作量，我们暂时先看上面这些。
