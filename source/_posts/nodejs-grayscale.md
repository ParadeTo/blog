---
title: 实战 - Node.js 服务实现灰度发布（Grayscale Release for Node.js Server in Practice）
date: 2024-01-16 17:20:04
tags:
  - nodejs
  - grayscale
categories:
  - nodejs
description: 本文介绍了实现了灰度发布的几个方案，并针对一个进行详细的讨论（This article introduce some solutions of implementing grayscale release and discuss one in detail）
---

# 前言 - Preface

所谓灰度发布（本文特指金丝雀发布），就是线上同时存在两个版本，这里我们把新发布的版本称作金丝雀版，旧版称作稳定版。根据一定的策略让部分用户访问金丝雀版，部分用户访问稳定版。同时还需要根据线上两个版本的监控数据来调整流量比例。通过这种方式可以，我们可以：

- 在不影响太多用户的前提下，帮助我们提前发现软件中潜在的问题
- 方便我们在同一时期在两个版本之间进行一些对比

所以，实现灰度发布还是比较有意义的一件事情。

Grayscale release(In this article we refer to the canary release specifically) is to make there are two versions online at the same time(Here, we refer to the new version as Canary, and the old version as Stable). Then according to a specific strategy, we can expose the Canary to a portion of users, and expose the Stable to others.
At the same time, we need to adjust the traffic ratio based on the two versions' behavior. In this way, we can:

- Help us identify potential problems in advance without affecting many users
- Help us easily compare new and old versions during the same period

So building a grayscale release system is significant.

# 可选方案 - Solutions

一般情况下，我们的 Node.js 服务都会按照如下的架构运行：

Generally, a Node.js server will run under the follow architecture:

![](./nodejs-grayscale/1.png)

用户访问先到达网关层，网关层采用负载均衡策略把流量分发到各个容器，容器中通过 PM2 集群模式运行 Node.js 服务，主进程接收连接并分发到子进程（关于 Node.js cluster 模块可以看[这篇文章](/2022/12/15/nodejs-cluster-principle/)）。

The request reaches to the gateway, then the gateway will distribute the traffic to containers according to loading balance strategy. In a container, a Node.js server will be deployed in cluster mode using PM2. The master process will receive the connection and distribute among child processed. Refer to [this article](/2022/12/15/nodejs-cluster-principle/) to learn more about Node.js cluster.

所以，我们可以从不同的层面来实现灰度发布。

So, we can implement grayscale release from different levels.

## 基于容器 - Based on Containers

![](./nodejs-grayscale/2.png)

优点：

- 对服务代码 0 侵入
- 不同版本之间完全隔离
- 借助现成的容器管理相关工具，可以比较方便地实现

缺点：

- 灵活性较差，比如如果我们需要根据用户的一些特征来进行流量分发的话需要在网关层写一些代码，但是网关层一般是通用的，不一定能支持。

## 基于进程 - Based on Processes

![](./nodejs-grayscale/3.png)

优点：

- 非常灵活，可以在 Master Process 按照业务需求来实现各种策略的流量分发
- 对服务代码侵入小，这里不说 0 侵入的原因是需要看具体的实现方式，见下文。

缺点：

- 版本间通过进程隔离，不是非常彻底。比如某个版本出现内存泄漏问题，可能会影响另一个版本的运行。
- 需要自己实现主进程并进行进程管理，无法复用 PM2。且主进程如果出现了比较严重的问题，整个灰度发布系统也会瘫痪。

## 基于模块 - Based on Modules

![](./nodejs-grayscale/4.png)

所谓模块，其实就是一个 JS 文件，以 koa 为例，用代码表示大概就是这样：

```js
// canary.js/stable.js
const koa = require('koa')
const app = new Koa()
app.use(async function(ctx) {
  ctx.body = 'canary' // or stable
})
module.exports = app

// index.js
const http = require('http')
const canaryApp = require('./canary')
const stableApp = require('./stable')

http.createServer((req, res) => {
  if (/* Canary */) {
    canaryApp.callback()(req, res)
  } else {
    stableApp.callback()(req, res)
  }

}).listen(8080)
```

优点：

- 同样可以非常灵活地实现各种策略的流量分发
- 相比基于进程的方式，不需要自己实现主进程及进程管理相关逻辑，可以复用 PM2

缺点：

- 不同版本运行在同一个上下文，版本间的隔离性非常依赖程序员的技术水平。如果某个版本运行有异常，可能另外一个版本也无法运行，这个是最为致命的，直接导致我们的灰度发布无法起作用。

考虑到我们的需求一：需要可以灵活制定流量分发策略，排除基于容器的方案。而方案 3 又有着致命的缺点，所以我们采用方案 2，即基于进程来实现。
