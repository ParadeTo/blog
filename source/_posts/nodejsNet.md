---
title: nodejs之网络编程
date: 2017-06-07 18:03:04
tags:
- nodejs
categories:
- nodejs
description: nodejs网络编程
---

> 在Web领域，大多数的编程语言需要专门的Web服务器作为容器，如ASP、APS.NET需要IIS，PHP需要搭建Apache或Nginx环境，JSP需要Tomcat服务器等。但是对于Node而言，只需要几行代码即可构建服务器，无需额外的容器。
> Node提供了net、dgram、http、https四个模块分别用于处理TCP、UDP、HTTP、HTTPS，适用于服务器端和客户端。


# 构建TCP服务
## TCP
* 在网络七层协议中属于传输层协议
* 需要三次握手形成会话

**关于TCP的文章：**
* http://www.jellythink.com/archives/705
* http://blog.csdn.net/oney139/article/details/8103223

**【问题1】为什么连接的时候是三次握手，关闭的时候却是四次握手？**

答：因为当Server端收到Client端的SYN连接请求报文后，可以直接发送SYN+ACK报文。其中ACK报文是用来应答的，SYN报文是用来同步的。但是关闭连接时，当Server端收到FIN报文时，很可能并不会立即关闭SOCKET，所以只能先回复一个ACK报文，告诉Client端，"你发的FIN报文我收到了"。只有等到我Server端所有的报文都发送完了，我才能发送FIN报文，因此不能一起发送。故需要四步握手。

## 创建TCP服务器端和客户端
* server.js

```javascript
var net = require('net')

var server = net.createServer(function (socket) {
  // 新的连接
  socket.on('data', function (data) {
    console.log(data.toString())
    socket.write("你好")
  })

  socket.on('end', function () {
    console.log('连接断开')
  })
  socket.write("欢迎光临《深入浅出node.js》示例：\n")
})

server.listen(8124, function () {
  console.log('server bound')
})
```

* client.js

```javascript
var net = require('net')
var client = net.connect({port:8124}, function () {
  console.log('client connected')
  client.write('world!\r\n')
})

client.on('data', function (data) {
  console.log(data.toString())
  client.end()
})

client.on('end', function () {
  console.log('client disconnected')
})
```

先后启动``server.js``,``client.js``,得到如下输出：

```javascript
// server.js
server bound
world!

连接断开

// client.js
client connected
欢迎光临《深入浅出node.js》示例：

你好
client disconnected
```

## TCP服务的事件
### 服务器事件
* listening：在调用``server.listen()``后触发
* connection：客户端连接到服务器时触发，简洁写法为通过``net.createServer()``最后一个参数传递
* close：服务器关闭时触发
* error：服务器发生异常时触发，比如监听一个使用中的端口