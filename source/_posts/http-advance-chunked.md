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

在 HTTP 的头部字段中，大家对 `Content-Length` 肯定不陌生，它表示包体的长度，目的是方便 HTTP 应用层从 TCP 层正确快速地读取到包体数据。而当包体长度未知或者我们想把包体拆成几个小块传输时， `Transfer-Encoding: chunked` 就可以派上用场了。

# 包体格式
当服务器返回 `Transfer-Encoding: chunked` 时，表明此时服务器会对返回的包体进行 `chunked` 编码，每个 chunk 的格式如下所示：

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

1\r\n
a\r\n
2\r\n
bc\r\n
3\r\n
def\r\n
14\r\n
ghijklmnopqrstuvwxyz\r\n
0\r\n\r\n
```

# nodejs 实战 chunked 编码
说什么都不如动手实战一把，于是写了一个 DEMO 测试一下：

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

从结果中发现，传入 `res.write` 的参数都被当做了 chunk 的内容，通过 telnet 调试发现确实如此：

![](2.png)

难道 `res.write` 自动帮我们进行了 chunked 编码？带着这个问题翻阅了一下 nodejs 的源码，结果发现确实如此。顺着这个路径 `lib/_http_outgoing.js -> OutgoingMessage.prototype.write -> write_` 我们可以得到答案：

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

`chunked` 编码格式还是比较简单的，那么它到底有啥用呢？

# 使用场景1-大文件下载
当从服务器下载一个比较大的文件时，可以使用 chunked 编码来节省内存等资源。

## 不使用 chunked 编码
### 代码
不使用 chunked 编码时需要将文件一次性读到内存中然后返回给用户：
```javascript
const http = require('http')
const fs = require('fs')

const dir = process.env.dir || '/data'
const filename = `${dir}/movie.mkv`

http
  .createServer(async function(req, res) {
    try {
      const data = fs.readFileSync(filename)
      console.log('length', data.length)
      res.end(data)
    } catch (error) {
      console.error('error', error)
    }
  })
  .listen(3001)
```
### 使用 Docker 模拟服务器内存不足
#### Dockerfile
```
FROM node:10-alpine

WORKDIR /usr/src/app

VOLUME /data

COPY . .

EXPOSE 3001

CMD [ "node", "index" ]
```

#### 构建镜像
`docker build -t chunk-demo1 .`

#### 启动容器
```
docker run \
-it \
-m 512m \
--rm \
-v /Users/youxingzhi/ayou/net-advance/http-advance/range/demo/server/files:/data \
-p 3001:3001 \
--name chunk-demo1 \
--oom-kill-disable \
chunk-demo1
```

其中 `oom-kill-disable` 表示当启动的容器的内存不足时不关闭容器

### 验证结果
通过浏览器访问 `http://localhost:3001`，发现浏览器一直处于 loading 的状态：
![](3.png)

通过 `docker stats chunk-demo1` 监控容器的运行状态，发现内存使用率处于 100% 左右：
![](4.png)

## 使用 chunked 编码
### 代码
这里使用到了流的 `pipe` 方法，“管道”的这头源源不断从文件中读取数据，“管道”的那头通过 `chunked` 编码将数据返回给客户端。
```javascript
const http = require('http')
const fs = require('fs')

const dir = process.env.dir || '/data'
const filename = `${dir}/movie.mkv`

http
  .createServer(async function(req, res) {
    const readStream = fs.createReadStream(filename)
    readStream.pipe(res)
  })
  .listen(3001)
```

### 使用 Docker 模拟服务器内存不足
这一步跟上文一样，只需要把 `chunk-demo1` 换成 `chunk-demo2` 即可

### 验证结果
通过浏览器访问 `http://localhost:3001`， 发现可以正常访问：
![](5.png)

通过 `docker stats chunk-demo2` 监控容器的运行状态，发现内存使用率一直维持在一个较小的水平：
![](6.png)

# 使用场景2-Bigpipe
Bigpipe 想要实现的效果是：用户打开网站，可以快速的看到网站的框架，其他细节内容会逐渐呈现给用户。借助 ajax 技术，这种效果我们很早就实现了，不过 ajax 技术是通过发送额外的 HTTP 请求来实现的，而通过 chunked 编码我们可以在一个请求之内达到我们的目的。下面用一个简单的例子来演示一下这种技术：

## 前端代码
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <script>
      var Bigpipe = function() {
        this.callbacks = {}
      }
      Bigpipe.prototype.ready = function(key, callback) {
        if (!this.callbacks[key]) {
          this.callbacks[key] = []
        }
        this.callbacks[key].push(callback)
      }
      Bigpipe.prototype.set = function(key, data) {
        var callbacks = this.callbacks[key] || []
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i].call(this, data)
        }
      }
    </script>
    <script>
      var bigpipe = new Bigpipe()
      bigpipe.ready('personInfo', function(data) {
        for (let k in data) {
          const $ele = document.querySelector('#' + k)
          $ele.innerHTML = data[k]
        }
      })
      bigpipe.ready('articles', function(data) {
        const $ele = document.querySelector('#articles')
        let html = ''
        data.forEach(article => {
          html += `<li>${article.title}</li>`
        })
        $ele.innerHTML = html
      })
    </script>
  </head>
  <body>
    <h1>个人信息</h1>
    <p>姓名：<span id="name"></span></p>
    <p>年龄：<span id="age"></span></p>
    <p>性别：<span id="gender"></span></p>
    <h1>文章列表</h1>
    <ul id="articles"></ul>
  </body>
</html>
```

这里的 Bigpipe 其实实现的是一个“发布/订阅”系统，代码事先订阅了两个事件，当事件发生时将数据渲染到页面中。而返回的页面只是一个简单的框架，没有任何实际内容。

## 后端代码
```javascript
const http = require('http')
const fs = require('fs')

function sendPersonInfo(res) {
  return new Promise(resolve => {
    setTimeout(() => {
      const data = {
        name: 'ayou',
        age: 18,
        gender: '男'
      }
      res.write(`<script>bigpipe.set('personInfo', ${JSON.stringify(data)})</script>`)
      resolve()
    }, 1000)
  })
}

function sendArticles(res) {
  return new Promise(resolve => {
    setTimeout(() => {
      const list = []
      for (let i = 0; i < 10; i++) {
        list.push({
          title: `网络协议进阶${i + 1}`
        })
      }
      res.write(`<script>bigpipe.set('articles', ${JSON.stringify(list)})</script>`)
      resolve()
    }, 3000)
  })
}

http
  .createServer(async function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/html;charset=utf-8'
    })
    const html = fs.readFileSync('./index.html')
    res.write(html)
    await Promise.all([sendPersonInfo(res), sendArticles(res)])
    res.end()
  })
  .listen(3000)
```

后端代码通过 chunked 编码（上文已经说过，res.write 会自动进行 chunked 编码）返回了 html，然后模拟获取数据的耗时操作，当数据获取到后返回一段 javascript 脚本给客户端，当脚本执行时会触发上文所说的事件，并传递所获取到的数据，最终将内容呈现给用户。

# 结语
本文介绍了 HTTP 中的 chunked 编码格式及使用方法，并通过两个 Demo 介绍了它的使用场景，不过应对这些场景使用其他技术也可以，比如前端轮询、websocket等，这里只是多提供一种思路。








