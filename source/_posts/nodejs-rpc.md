---
title: Node.js 高级编程之 RPC
date: 2023-01-09 19:57:37
tags:
  - nodejs
categories:
  - nodejs
description: Node.js 高级编程之 RPC
---

# 前言

在构建微服务时，为了追求极致的效率，服务间一般会使用 RPC（Remote Procedure Call）来进行通信。本文通过 Node.js 来实践一下。

# Node.js RPC

## 一个最简单的例子

首先我们来构建一下 `server`：

```js
// server.js
const net = require('net')
const {msgBuffer} = require('../utils')

const server = net.createServer((clientSocket) => {
  clientSocket.on('data', (data) => {
    msgBuffer.push(data)
    while (!msgBuffer.isFinished()) {
      const message = JSON.parse(msgBuffer.handleData())
      clientSocket.write(
        JSON.stringify(fnMap[message.cmd].apply(null, message.params)) + '\n'
      )
    }
  })
})

server.listen(9999, () => console.log('Listening on 9999'))

const fnMap = {
  sum: (...args) => {
    let s = 0
    for (let i = 0; i < args.length; i++) {
      s += args[i]
    }
    return s
  },
  multiply: (...args) => {
    let p = 1
    for (let i = 0; i < args.length; i++) {
      p *= args[i]
    }
    return p
  },
}

// MessageBuffer
class MessageBuffer {
  constructor(delimiter) {
    this.delimiter = delimiter
    this.buffer = ''
  }

  isFinished() {
    if (
      this.buffer.length === 0 ||
      this.buffer.indexOf(this.delimiter) === -1
    ) {
      return true
    }
    return false
  }

  push(data) {
    this.buffer += data
  }

  getMessage() {
    const delimiterIndex = this.buffer.indexOf(this.delimiter)
    if (delimiterIndex !== -1) {
      const message = this.buffer.slice(0, delimiterIndex)
      this.buffer = this.buffer.replace(message + this.delimiter, '')
      return message
    }
    return null
  }

  handleData() {
    const message = this.getMessage()
    return message
  }
}

exports.msgBuffer = new MessageBuffer('\n')
```

我们新建了一个 TCP 的服务，并监听来自客户端的数据，注意这里我们通过一个 `MessageBuffer` 类来对数据进行解析（详细参考文末补充内容：关于 TCP “粘包”问题说明），将 TCP 数据流解析成我们的消息体。然后调用服务端预先配置好的方法，最后将返回值返回给客户端。

客户端相对比较简单，将函数调用相关数据按照事先规定好的格式发送给服务端即可：

```js
const net = require('net')
const {msgBuffer} = require('../utils')

const client = net.connect({port: 9999}, () => {
  client.write(JSON.stringify({cmd: 'sum', params: [1, 2, 3]}) + '\n')
  client.write(JSON.stringify({cmd: 'multiply', params: [1, 2, 3]}) + '\n')
})

client.on('data', (data) => {
  msgBuffer.push(data)
  while (!msgBuffer.isFinished()) {
    const message = JSON.parse(msgBuffer.handleData())
    console.log(message)
  }
})
```

这样，一个非常简单的 RPC 雏形就出来了，不过有几个问题：

- 目前这种方式还不是 RPC。所谓的 RPC，就是客户端必须像调用本地方法一样来调用远端的方法，而不是还需要自己组装消息体，并监听事件获取返回值。理想中的方式应该像这样：

```js
const result = await client.sum(1, 2, 3)
```

所以我们在客户端和服务端都必须要有个代理来负责将函数调用

-

```js
// client.js
const net = require('net')
const {msgBuffer} = require('../utils')

const client = net.connect({port: 9999}, () => {
  client.write(JSON.stringify({cmd: 'sum', params: [1, 2, 3]}) + '\n')
  client.write(JSON.stringify({cmd: 'multiply', params: [1, 2, 3]}) + '\n')
})

client.on('data', (data) => {
  msgBuffer.push(data)
  while (!msgBuffer.isFinished()) {
    const message = JSON.parse(msgBuffer.handleData())
    console.log(message)
  }
})
```

# 补充内容

## 关于 TCP “粘包”问题说明

首先声明一下，所谓的 TCP “粘包问题”其实并不是一个问题。

先看一个简单的例子：

```js
// server.js
const net = require('net')

const server = net.createServer((clientSocket) => {
  console.log('Client connected')
  clientSocket.on('data', (data) => {
    console.log('-------------------')
    console.log(data.toString())
  })
})

server.listen(9999, () => console.log('Listening on 9999'))

// client.js
const net = require('net')

const client = net.connect({port: 9999}, () => {
  client.write(JSON.stringify({cmd: 'sum', params: [1, 2]}))
  client.write(JSON.stringify({cmd: 'multiply', params: [1, 2, 3]}))
})
```

启动 `server` 后再运行 `client`，则 `server` 有**可能**会打印如下日志：

```js
-------------------
{"cmd":"sum","params":[1,2]}{"cmd":"multiply","params":[1,2,3]}
```

如上所示，客户端调用了两次 `write`，但是服务端却只打印了一次。也就是说，两次发送的数据在服务端被一次性取出来了，即使用方层面的两个包“粘在”了一起，原因在于 TCP 是面向字节流的，并没有包的概念，所以开发者需要对 `data` 事件获取到的数据进行解析。

# 参考

1. https://blog.bitsrc.io/writing-an-rpc-library-in-node-js-673632413f5f
2. https://thrift.apache.org/tutorial/nodejs.html
3.
