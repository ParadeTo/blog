---
title: Node.js 高级编程之 UDP（看看它是如何不可靠的）
date: 2023-03-22 10:30:41
tags:
  - nodejs
categories:
  - nodejs
description: Node.js 高级编程之 UDP
---

# 前言

UDP 协议是我们平时较少接触到的知识，不同于 TCP，它是“不可靠”的，今天我们就来实战一下看下它到底怎么个不可靠法？

# 不可靠的 UDP

实验前，我们先介绍一下需要用到的工具（Mac 环境，其他环境请自行搜索相关工具）：

- Network Link Conditioner：模拟丢包场景，可以去[苹果开发者网站](https://developer.apple.com/download/all/?q=Additional%20Tools)上下载
- Wireshark：抓包分析工具
- 云主机：因为实现发现 Network Link Conditioner 对本地回环地址不起作用，如果有更好的方法求大佬指出

然后我们准备两段代码，一段作为 UDP Server，一段作为 UDP Client，Client 会向 Server 发送 26 个英文大写字母，Server 会将他们存到文件：

```js
// udp-server.js
const udp = require('dgram')
const server = udp.createSocket('udp4')
const fs = require('fs')

server.on('listening', function () {
  var address = server.address()
  var port = address.port
  console.log('Server is listening at port ' + port)
})

server.on('message', function (msg, info) {
  console.log(
    `Data received from ${info.address}:${info.port}: ${msg.toString()}`
  )
  fs.appendFileSync('./out', msg.toString())
})

server.on('error', function (error) {
  console.log('Error: ' + error)
  server.close()
})

server.bind(7788)

// udp-client.js
const udp = require('dgram')
const client = udp.createSocket('udp4')

for (let i = 0; i < 26; i++) {
  const char = String.fromCharCode(0x41 + i)
  client.send(Buffer.from(char), 7788, '********', function (error) {
    if (error) {
      console.log(error)
    }
  })
}
```

接着我们按照下面步骤开始实验：

1. 通过 Network Link Conditioner 把丢包率设置为 50%：

![](./nodejs-udp/50drop.png)

2. 设置好 Wireshark 的抓包参数：

![](./nodejs-udp/wireshark.png)

3. 在云主机上启动 Server，在本地启动 Client。

接着，我们来看一下实验结果：

1. 首先，我们可以看到服务端接收到的字母少了很多，只有 14 个：

![](./nodejs-udp/receive.png)

2. 服务端接收到的字母顺序是乱序的，比如 U 跑到了 T 的前面：

![](./nodejs-udp/order.png)

为了进行对比，我们可以换成 TCP 试试，代码如下，结果就不贴了：

```js
// tcp-server.js
const net = require('net')
const server = net.createServer()

const fs = require('fs')
server.on('connection', function (conn) {
  conn.on('data', (msg) => {
    console.log(
      `Data received from ${conn.address().address}:${
        conn.address().port
      }: ${msg.toString()}`
    )
    fs.appendFileSync('./out', msg.toString())
  })
})

server.listen(8899, () => {
  console.log('server listening to %j', server.address().port)
})

// tcp-client.js
var net = require('net')

var client = new net.Socket()
client.connect(8899, '********', function () {
  for (let i = 0; i < 26; i++) {
    const char = String.fromCharCode(0x41 + i)
    client.write(char)
  }
})
```

接下我们试试基于 UDP 来实现一个可靠的传输协议，主要解决上面的丢包和乱序问题。

# 基于 UDP 的简单可靠传输协议

首先，需要设计一下我们的协议格式。为了简单起见，我们只在原来 UDP 的数据部分分别新增 4 个字节的 SEQ 和 ACK：

```js
+-------------------------------+
|      64 个字节的 UDP 首部       |
+-------------------------------+
|  SEQ(4 个字节) |  ACK(4 个字节) |
+-------------------------------+
|             Data              |
+-------------------------------+
```

其中 SEQ 表示当前包的序号，ACK 表示回复序号。

接下来看看，我们如何解决前面的两个问题。

## 乱序问题

接收方需要维护一个变量 `expectedSeq` 的变量表示期待接收到的包序号。为了简单起见，我们制定如下规则：如果当前接收到的包序号等于 `expectedSeq`，则把包交给应用层处理，并发送 ACK 给发送方；否则我们都直接丢弃。当然更好的做法是维护一个接收窗口，这样可以批量的提交数据给应用层，也可以用来缓存大于 `expectedSeq` 的包。

假设现在发送方发送了 1 2 3 两个包，但是到达接收方的顺序是 3 2 1，按照我们的规则接收方会丢弃 3 和 2，接收 1。好家伙，顺序倒是不乱了，但是包没了。

所以还得把丢包问题也解决了才行。

## 丢包问题

发送方维护一个发送窗口用来存储已发送但是还未被确认的包：

```js
+---+---+---+---+
| 1 | 2 | 3 | 4 |
+---+---+---+---+
```

发送方每发送一个包的同时还需要将包放入发送窗口，并设置一个定时器用来重发这个包。当发送方接收到来自接收方的 ACK 时，需要取消掉对应包的定时器，并将发送窗口中小于 ACK 的包都删除。

```js
+---+---+---+---+
| 1 | 2 | 3 | 4 |
+---+---+---+---+

// ACK = 4，删除 1 2 3，并取消掉他们的定时器
+---+
| 4 |
+---+
```

完整代码及使用 Demo 见文末，现在可以正常按顺序输出 26 个字母了，但是离“可靠”协议还差得远。比如第一次输出完 26 个字母后，我们再次启动客户端时发现就没有任何输出了。原因在于此时接收端的 `expectedSeq` 已经是 20 多了，但是新启动的 client 发送的 SEQ 还是从 1 开始的，结果就是接收端一直丢弃接收到的包，发送端一直重试。

要解决这个问题，可以参考 TCP 在传输两端建立“连接”的概念，在开始发送前通过“三次握手”建立连接，也就是确定起始 SEQ，初始化窗口等工作，结束前通过“四次挥手”断开连接，即清理窗口定时器等工作。这个就留到以后再说吧。

# 代码

```js
// packet.js
class Packet {
  constructor({seq, ack, data = ''}) {
    this.seq = seq // 序列号
    this.ack = ack // 确认号
    this.data = data // 数据
  }

  // 将 Packet 转换成 Buffer，以便通过网络传输
  toBuffer() {
    const seqBuffer = Buffer.alloc(4)
    seqBuffer.writeUInt32BE(this.seq)

    const ackBuffer = Buffer.alloc(4)
    ackBuffer.writeUInt32BE(this.ack)

    const dataBuffer = Buffer.from(this.data)

    return Buffer.concat([seqBuffer, ackBuffer, dataBuffer])
  }

  // 从 Buffer 中解析出 Packet
  static fromBuffer(buffer) {
    const seq = buffer.readUInt32BE()
    const ack = buffer.readUInt32BE(4)
    const data = buffer.slice(8)

    return new Packet({seq, ack, data})
  }
}

module.exports = Packet

// reliableUDP.js
const dgram = require('dgram')
const Packet = require('./packet')

class ReliableUDP {
  constructor() {
    this.socket = dgram.createSocket('udp4')
    this.socket.on('message', this.handleMessage.bind(this))

    this.sendWindow = [] // 发送窗口，用于存放待确认的数据包
    this.receiveWindow = [] // 接收窗口，用于存放已接收的数据包
    this.expectedSeq = 1 // 期望接收的数据包序列号
    this.nextSeq = 1 // 下一个要发送的数据包序列号
    this.timeout = 100 // 超时时间，单位为毫秒
    this.timeoutIds = {} // 用于存放定时器 ID
  }

  listen(port, address, fn) {
    this.socket.bind(port, address, fn)
  }

  // 发送数据包
  sendPacket(packet, address, port) {
    const buffer = packet.toBuffer()
    this.socket.send(buffer, port, address, (err) => {
      if (err) {
        console.error(err)
      }
    })

    if (packet.ack) return

    if (!this.sendWindow.includes((p) => p.seq === packet.seq))
      this.sendWindow.push(packet)

    // 设置超时定时器
    const timeoutId = setTimeout(() => {
      this.handleTimeout(packet.seq, address, port)
    }, this.timeout)
    this.timeoutIds[packet.seq] = timeoutId
  }

  // 处理接收到的数据包
  handleMessage(msg, rinfo) {
    const {address, port} = rinfo
    const packet = Packet.fromBuffer(msg)

    // 收到的是应答的包
    if (packet.ack) {
      const ackNum = packet.ack - 1
      // 处理发送窗口中已经确认的数据包
      while (this.sendWindow.length > 0 && this.sendWindow[0].seq <= ackNum) {
        this.sendWindow.shift()
      }
      // 清除超时定时器
      if (this.timeoutIds[ackNum]) {
        clearTimeout(this.timeoutIds[ackNum])
        delete this.timeoutIds[ackNum]
      }
    } else {
      // 如果是重复的数据包，则忽略
      if (packet.seq < this.expectedSeq) {
        return
      }

      // 如果是期望接收的数据包
      if (packet.seq === this.expectedSeq) {
        this.receiveWindow.push(packet)
        this.expectedSeq++

        // 处理接收窗口中已经确认的数据包
        while (
          this.receiveWindow.length > 0 &&
          this.receiveWindow[0].seq <= this.expectedSeq
        ) {
          const packet = this.receiveWindow.shift()
          this.onPacketReceived(packet.data)
        }

        const ackPacket = new Packet({
          seq: this.nextSeq++,
          ack: this.expectedSeq,
        })
        this.sendPacket(ackPacket, address, port)
      } else {
        // 如果是未来的数据包，暂不做处理，更好的做法是缓存起来
      }
    }
  }

  // 应用层调用该方法发送数据
  send(data, address, port) {
    const packet = new Packet({
      seq: this.nextSeq,
      ack: null,
      data,
    })
    this.sendPacket(packet, address, port)
    this.nextSeq++
  }

  // 应用层调用该方法注册回调函数，接收数据
  onReceive(callback) {
    this.onPacketReceived = callback
  }

  // 处理超时
  handleTimeout(seq, address, port) {
    // 重传超时的数据包
    const packet = this.sendWindow.find((p) => p.seq === seq)
    if (packet) {
      this.sendPacket(packet, address, port)
    }
  }
}

module.exports = ReliableUDP

// server.js
const ReliableUDP = require('./reliableUDP')

const server = new ReliableUDP()
server.listen(7788, 'localhost')
server.onReceive((data) => {
  console.log(data.toString())
})

// client.js
const ReliableUDP = require('./reliableUDP')

const client = new ReliableUDP()
for (let i = 0; i < 26; i++) {
  const char = String.fromCharCode(0x41 + i)
  client.send(char, 'localhost', 7788)
}
```
