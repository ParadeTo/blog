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

当初学习 cluster 时，一直好奇它是怎么做到多个子进程监听同一个端口而不冲突的，比如下面这段代码：

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

趁着 CY 之际，来搞清楚一下。

# 准备调试环境

学习 Node.js 官方提供的库最好的方式当然是调试一下，所以，我们先来准备一下环境。注：本文的操作系统为 macOS Big Sur 11.6.6，其他系统请自行准备相应环境。

## 编译 Node.js

1. 下载 Node.js 源码

```
git clone https://github.com/nodejs/node.git
```

2. 进入目录，执行

```
./configure --debug
make -j4
```

之后会生成 `out/Debug/node`

## 准备 IDE 调试环境

本文使用 vscode，其他 IDE 请自行解决。

1. 准备 `launch.json`：

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
      "program": "${workspaceFolder}/index.js"
    }
  ]
}

```

2. 调试代码（为了调试而已，这里启动一个子进程就够了）：

```js
const cluster = require('cluster')
const http = require('http')

if (cluster.isPrimary) {
  debugger
  cluster.fork()
} else {
  debugger
  http
    .createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'})
      res.end('handled by child, pid is ' + cluster.worker.process.pid + '\n')
    })
    .listen(9999)
}
```

接下来，我们就开始调试了。很明显，我们可以分父进程和子进程两部分来调试：

# Master

# Worker
