---
title: HTTP 进阶之 chunked 编码
date: 2020-01-01 16:27:36
tags:
- http
- chunked
categories:
- WWW
description: 介绍 HTTP 中 chunked 编码的基本知识并给出了几个使用场景的例子
---

`Transfer-Encoding: chunked` 头部平时接触的比较少，我们一般都是跟他的兄弟 `Content-Length` 打交道。`Content-Length` 表示了包体的长度，而当包体长度未知或者我们想把包体拆成几个小块传输时， `Transfer-Encoding: chunked` 就可以派上用场了。

# 包体格式
当服务器返回 `Transfer-Encoding: chunked` 时，包体的格式也有要求，每个 chunk 的格式如下所示：

```
${chunk-length}\r\n${chunk-data}\r\n
```

其中，`${chunk-length}` 表示 chunk 的字节长度，使用 16 进制表示，`${chunk-data}` 为 chunk 的内容。

当 chunk 都传输完，需要额外传输 `0\r\n\r\n` 表示结束。

下面是一个例子：

```
HTTP/1.1 200 OK
Date: Wed, 01 Jan 2020 08:46:31 GMT
Connection: keep-alive
Transfer-Encoding: chunked

1
a
2
bc
3
def
14
ghijklmnopqrstuvwxyz
0
```

# nodejs 实战 chunked 编码
说什么都不如自己动手，于是写了一个 DEMO 测试一下：

```javascript
var http = require('http')

const chunks = ['a', 'bc', 'def', 'ghijklmnopqrstuvwxyz']

http
  .createServer(async function(req, res) {
    res.writeHead(200, {
      'Transfer-Encoding': 'chunked'
    })
    for (let index = 0; index < chunks.length; index++) {
      res.write(`${chunks[index].length.toString(16)}\r\n${chunks[index]}\r\n`)
    }
    res.write('0\r\n\r\n')
    res.end()
  })
  .listen(3000)
```

打开浏览器，发现结果不正确：

![](1.png)

从结果中发现，传入 `res.write` 的参数都被当做了 chunk 的内容，通过 telnet 调试下发现确实如此：

![](2.png)

难道 `res.write` 自动帮我们进行了 chunked 编码？带着这个问题翻阅了一下 nodejs 的源码，发现确实如此。顺着这个路径 `lib/_http_outgoing.js -> OutgoingMessage.prototype.write -> write_` 我们可以得到答案：

```javascript
    if (typeof chunk === 'string')
      len = Buffer.byteLength(chunk, encoding);
    else
      len = chunk.length;

    msg._send(len.toString(16), 'latin1', null);
    msg._send(crlf_buf, null, null);
    msg._send(chunk, encoding, null);
    ret = msg._send(crlf_buf, null, callback);
```

# 使用场景1-大文件下载
当从服务器下载一个比较大的文件时，可以使用 chunked 编码来节省内存、带宽等资源。

## 不使用 chunked 编码
首先我们写一个简单的


