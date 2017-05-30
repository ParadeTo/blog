---
title: nodejs之cluster模块
date: 2017-05-27 22:03:44
tags:
- nodejs
- cluster
categories:
- nodejs
description: 关于nodejs多进程架构以及cluster模块
---

在学习cluster模块之前，本文先要聊聊服务模型的变迁，然后分析下nodejs的多进程架构，最后才正式开始学习cluster。

# 服务模型的变迁
## 石器时代：同步
最早的服务器，其执行模型是同步的，它的服务器模式是一次为一个请求服务，所有请求都得按次序等待服务。这意味着除了当前的请求被处理外，其余请求都处于耽误的状态。假设每次相应服务耗用的时间稳定为N秒，这类服务的QPS为1/N。

以下是用python实现的一个http服务器：

```python
import socket

# 初始化socket
from time import sleep

s = socket.socket()
# 主机名
host = "localhost"
# 默认的http协议端口号
port = 8080
# 绑定服务器socket的ip和端口号
s.bind((host, port))
# 服务器名字/版本号
server_name = "MyServerDemo/0.1"
# 相应网页的内容
content = '''
<html>
<head><title>MyServerDemo/0.1</title></head>
<body>
<h1>Hello, World!</h1>
</body>
</html>
'''

# 可同时连接2个客户端
s.listen(2)

# 提示信息
print "You can see a HelloWorld from this server in ur browser, type in", host, "\r\n"

# 服务器循环
while True:
    # 等待客户端连接
    c, addr = s.accept()
    print "Got connection from", addr, "\r\n"

    # 显示请求信息
    print "--Request Header:"
    # 接收浏览器的请求, 不作处理
    data = c.recv(1024)
    print data
	# 模拟阻塞
    sleep(3)
    # 相应头文件和内容
    response = '''HTTP/1.1 200 OK
		Server: %s
		Content-Type: text/html;charset=utf8
		Content-Length: %s
		Connection: keep-alive
		
		%s''' % (
		        server_name,
		        len(content),
		        content
		    )
    # 发送回应
    c.send(response)
    print "--Response:\r\n", response
    c.close()
```

接下来，用``siege``进行并发测试(并发数为2)，由下面的时间可以判断并发数其实只有1，因为如果两个连接同时并发的话，时间应该都约等于3秒，现在除了第一个约等于3秒外，其他都约等于6秒，说明一个连接必须等到它前面那个连接处理完后才能处理。

```python
HTTP/1.1 200     3.01 secs:      99 bytes ==> GET  /
HTTP/1.1 200     6.01 secs:      99 bytes ==> GET  /
HTTP/1.1 200     5.89 secs:      99 bytes ==> GET  /
HTTP/1.1 200     5.55 secs:      99 bytes ==> GET  /
HTTP/1.1 200     5.99 secs:      99 bytes ==> GET  /
HTTP/1.1 200     5.69 secs:      99 bytes ==> GET  /
HTTP/1.1 200     5.54 secs:      99 bytes ==> GET  /
```


## 青铜时代：复制进程
为了解决并发问题，一个简单的做法是：复制多个进程来服务。假设服务进程数为M，则QPS为M/N。

随着并发的增长，系统的内存好耗用的很快，这是多进程不可避免的一个问题。

修改一下上面的代码，启动三个进程来服务：

```python
import socket
import os
from time import sleep

def handle_request(s):
    # 服务器循环
    while True:
        # 等待客户端连接
        c, addr = s.accept()
        print "Got connection from", addr, "\r\n"

        # 显示请求信息
        print "--Request Header:"
        # 接收浏览器的请求, 不作处理
        data = c.recv(1024)
        print data

        sleep(3)
        # 相应头文件和内容
        response = '''HTTP/1.1 200 OK
    Server: %s
    Content-Type: text/html;charset=utf8
    Content-Length: %s
    Connection: keep-alive

    %s''' % (
            server_name,
            len(content),
            content
        )
        # 发送回应
        c.send(response)
        print "--Response:\r\n", response
        c.close()

# 初始化socket
s = socket.socket()
# 主机名
host = "localhost"
# 默认的http协议端口号
port = 8080
# 绑定服务器socket的ip和端口号
s.bind((host, port))
# 服务器名字/版本号
server_name = "MyServerDemo/0.1"
# 相应网页的内容
content = '''
<html>
<head><title>MyServerDemo/0.1</title></head>
<body>
<h1>Hello, World!</h1>
</body>
</html>
'''

# 可同时连接1个客户端
s.listen(2)

# 提示信息
print "You can see a HelloWorld from this server in ur browser, type in", host, "\r\n"

for i in range(3):
    pid = os.fork()
    # 子进程
    if pid == 0:
        print 'I am child!'
        handle_request(s)
    else:
        print 'I am parent!'
```

再次启动两个并发进行测试，得到的结果如下所示：

```python
HTTP/1.1 200     3.00 secs:     103 bytes ==> GET  /
HTTP/1.1 200     3.00 secs:     103 bytes ==> GET  /
HTTP/1.1 200     3.00 secs:     103 bytes ==> GET  /
HTTP/1.1 200     3.01 secs:     103 bytes ==> GET  /
```

## 白银时代：多线程
多线程与多进程类似，不同之处在于线程的开销要小，且可以共享数据。但是在线程间进行上下文切换也是比较耗时的。


## 黄金时代：事件驱动
事件驱动模型是单进程单线程的，其带来的好处是：程序状态是单一的，没有锁、线程同步问题，上下文切换较少，可以很好地提高CPU的使用率。

但是一个Node进程只能使用一个CPU核，**如何充分利用多核服务器呢？**

另外，由于Node执行在单线程上，一旦单线程上抛出的异常没有捕获，将会引起整个进程的崩溃。**如何保证进程的健壮性和稳定性呢？**


# 多进程架构
首先，实现一个简陋的Master-Worker模式：

worker.js

```javascript
var http = require('http')
const port = Math.round((1 + Math.random()) * 1000)

console.log('listening on ' + port)

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plane'})
  res.end('Hello World\n')
}).listen(port)
```

master.js

```javascript
var fork = require('child_process').fork
var cpus = require('os').cpus()

for (var i = 0; i < cpus.length; i++) {
  fork('./worker.js')
}
```

启动master.js，会启动与cpu核数相同的服务

```javascript
listening on 1197
listening on 1999
listening on 1648
listening on 1426
```

这个例子启动的服务端口是随机的，实际应用中应该是对外暴露一个端口，下面会讲到如何解决。

不过先学习下进程吧。

## 创建子进程
* spawn()：启动一个子进程来执行命令
* exec()：同spawn()，有一个回调函数获知子进程的状况
* execFile()：启动一个子进程执行文件，文件行首需要加类似于下面的代码
	```bash
	#!/usr/bin/env node
	```
* fork()

```javascript
var cp = require('child_process)
cp.spawn('node', ['worker.js'])
cp.exec('node worker.js', function(err, stdout, stderr){})
cp.execFile('worker.js', function(err, stdout, stderr){})
cp.fork('./worker.js')
```

## 进程间通信
要实现主进程管理和调度工作进程的功能，需要主进程和工作进程之间的通信。

```javascript
// parent.js
var cp = require('child_process')
var n = cp.fork(__dirname + '/sub.js')
n.on('message', function (m) {
	console.log('PARENT got message:', m)
})
n.send({hello: 'world'})
// sub.js
process.on('message', function (m) {
	console.log('CHILD got message', m)
})

process.send({foo: 'bar'})
```

进程间通信原理实现的方法有：命名管道、匿名管道、socket、信号量、共享内存、消息队列、domain socket等，node中使用的是管道技术。

## 句柄传递
为了解决前面的多进程服务器对外无法暴露一个接口的问题，可以使用代理转发的策略，即主进程监听80端口，其他子进程监听不同的端口，主进程对外接收所有的网络请求，再将这些请求分别代理到不同的端口的进程上。

但是，由于进程每接收到一个连接，将会用掉一个文件描述符，因此代理方案中客户端连接到代理进程，代理进程连接到工作进程的过程需要用掉两个文件描述符。操作系统的文件描述符是有限的，代理方案浪费掉一倍数量的文件描述符的做法影响了系统的拓展能力。

为了解决上述问题，node引入了进程间发送句柄（用来标识资源的引用）的功能。

```javascript
child.send(message, [sendHandle])
```

示例：

```javascript
// parent.js
var child = require('child_process').fork('child.js')

var server = require('net').createServer()
server.on('connection', function (socket) {
  socket.end('handled by parent\n')
})

server.listen(1337, function () {
  child.send('server', server)
})
// child.js
process.on('message', function (m, server) {
  if (m === 'server') {
    server.on('connection', function (socket) {
      socket.end('handled by child\n')
    })
  }
})
```

使用curl工具测试：

```
youxingzhideMac-mini:mmsf ayou$ curl localhost:1337
handled by child
youxingzhideMac-mini:mmsf ayou$ curl localhost:1337
handled by child
youxingzhideMac-mini:mmsf ayou$ curl localhost:1337
handled by parent
youxingzhideMac-mini:mmsf ayou$ curl localhost:1337
handled by child
```

甚至，我们可以在主进程将服务器发送给子进程之后，就关掉主进程的服务器，如下所示，同时代码修改为启动多个子进程，并改为http层面的服务：

```javascript
// parent.js
var cp = require('child_process')
var child1 = cp.fork('child.js')
var child2 = cp.fork('child.js')

var server = require('net').createServer()
server.on('connection', function (socket) {
  socket.end('handled by parent\n')
})

server.listen(1337, function () {
  child1.send('server', server)
  child2.send('server', server)
  server.close()
})
// child.js
var http = require('http')
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('handled by child, pid is ' + process.pid + '\n')
})

process.on('message', function (m, tcp) {
  if (m === 'server') {
    tcp.on('connection', function (socket) {
      server.emit('connection', socket)
    })
  }
})
```

再次使用curl测试，发现服务全部来自于不同的子进程：

```
youxingzhideMac-mini:~ ayou$ curl localhost:1337
handled by child, pid is 604
youxingzhideMac-mini:~ ayou$ curl localhost:1337
handled by child, pid is 603
youxingzhideMac-mini:~ ayou$ curl localhost:1337
handled by child, pid is 603
...
```

这就实现了前面所说的实现对外暴露一个端口的想法，子进程代码中并没有listen某个端口。
 
 
### 句柄发送与还原
前面主进程把“服务器”发送给子进程了，这里面到底是怎么回事呢？

目前子进程对象``send()``方法可以发送的句柄类型包括：

* net.Socket:TCP套接字
* net.Server:TCP服务器
* net.Native: c++层面的TCP套接字或IPC管道
* dgram.Socket: UDP套接字
* dgram.Native: c++层面的UDP套接字

``send()``方法在将消息发送之前，将消息组装成两个对象，handle和message。message参数如下所示：

```json
{
	cmd: 'NODE_HANDLE',
	type: 'net.Server',
	msg: message	
}
```

发送的其实是句柄文件描述符（一个整数值）。message发送时会通过``JSON.stringify()``进行序列化。

子进程通过``JSON.parse()``反序列化得到原对象，触发``message``事件。如果``message.cmd``的值以``NODE_``为前缀，它将响应一个``internalMessage``，如果其值为``NODE_HANDLE``，它将取出``message.type``值和得到的文件描述符一起还原出一个对应的对象。以发送的TCP服务器为例，子进程收到消息后的还原过程如下所示：

```nodejs
function (message, handle, emit) {
	var self = this
	var server = new net.Server()
	server.listen(handle, function () {
		emit(server)
	})
}
```

以下来自http://taobaofed.org/blog/2015/11/10/nodejs-cluster-2/：

Node.js 中父进程调用 fork 产生子进程时，会事先构造一个 pipe 用于进程通信，

```javascript
new process.binding('pipe_wrap').Pipe(true);
```

构造出的 pipe 最初还是关闭的状态，或者说底层还并没有创建一个真实的 pipe，直至调用到 libuv 底层的uv_spawn, 利用 socketpair 创建的全双工通信管道绑定到最初 Node.js 层创建的 pipe 上。

管道此时已经真实的存在了，父进程保留对一端的操作，通过环境变量将管道的另一端文件描述符 fd 传递到子进程。

``options.envPairs.push('NODE_CHANNEL_FD=' + ipcFd);``
子进程启动后通过环境变量拿到 fd

``var fd = parseInt(process.env.NODE_CHANNEL_FD, 10);``
并将 fd 绑定到一个新构造的 pipe 上

```javascript
var p = new Pipe(true);
p.open(fd);
```

于是父子进程间用于双向通信的所有基础设施都已经准备好了。说了这么多可能还是不太明白吧？没关系，我们还是来写一个简单的demo感受下。

Node.js构造出的``pipe``被存储在进程的``_channel``属性上

```javascript
// master.js
const WriteWrap = process.binding('stream_wrap').WriteWrap;
const net = require('net');
const fork = require('child_process').fork;

var workers = [];
for (var i = 0; i < 4; i++) {
     var worker = fork(__dirname + '/worker.js');
     worker.on('disconnect', function () {
         console.log('[%s] worker %s is disconnected', process.pid, worker.pid);
     });
     workers.push(worker);
}

var handle = net._createServerHandle('0.0.0.0', 3000);
handle.listen();
handle.onconnection = function (err,handle) {
    var worker = workers.pop();
    var channel = worker._channel;
    var req = new WriteWrap();
    channel.writeUtf8String(req, 'dispatch handle', handle);
    workers.unshift(worker);
}

// worker.js

const net = require('net');
const WriteWrap = process.binding('stream_wrap').WriteWrap;
const channel = process._channel;
var buf = 'hello Node.js';
var res = ['HTTP/1.1 200 OK','content-length:' + buf.length].join('\r\n') + '\r\n\r\n' + buf;

channel.ref(); //防止进程退出
channel.onread = function (len, buf, handle) {
    console.log('[%s] worker %s got a connection', process.pid, process.pid);
    var socket = new net.Socket({
        handle: handle
    });
    socket.readable = socket.writable = true;
    socket.end(res);
    console.log('[%s] worker %s is going to disconnect', process.pid, process.pid);
    channel.close();
}
```

运行node master.js 输出

```
{"hello":"worker","pid":58731}
{"hello":"master","pid":58732}
channel closed
```

### 端口共同监听
独立启动的进程中，TCP服务器socket套接字的文件描述符并不相同，导致监听到相同的端口时会抛出异常。

但是由``send()``发送的句柄还原出来的服务，他们的文件描述符是相同的，所以监听相同端口不会引起异常。

# 集群稳定之路
经过上面的工作，似乎可以迎接客户端大量的请求了，但是，我们还有一些细节需要考虑：

* 性能问题
* 多个工作进程的存活状态管理
* 工作进程的平滑重启
* 配置或者静态数据的动态重新载入
* 其他细节

## 进程事件
除了message事件，node还有如下事件：

* error：子进程无法被复制创建、无法被杀死、无法发送消息时会触发
* exit：子进程退出时触发，如果正常退出，这个事件的第一个参数为退出码，否则为null。如果进程是通过kill方法杀死的，会得到第二个参数，它表示杀死进程时的信号。
* close：在子进程的标准输入输出流中止时触发该事件，参数与exit相同
* disconnect：在父进程或子进程中调用``disconnect()``方法时触发该事件。


## 自动重启
将前面的多进程架构代码稍微做一下修改：

```javascript
// master.js
var fork = require('child_process').fork
var cpus = require('os').cpus()

var server = require('net').createServer()
server.listen(1337)

var workers = {}
var createWorker = function () {
  var worker = fork(__dirname + '/worker.js')
  // 退出时重新启动新的进程
  worker.on('exit', function () {
    console.log('Worker ' + worker.pid + ' exited.')
    delete workers[worker.pid]
    createWorker()
  })
  // 句柄转发
  worker.send('server', server)
  workers[worker.pid] = worker
  console.log('Create worker. pid ' + worker.pid)
}

for (var i = 0; i < cpus.length; i++) {
  createWorker()
}

process.on('exit', function () {
  for (var pid in workers) {
    workers[pid].kill()
  }
})
```

启动服务：

```javascript
Create worker. pid 811
Create worker. pid 812
Create worker. pid 813
Create worker. pid 814
```

通过kill命令杀死某个进程试试，如下所示：

```
kill 811
...
Worker 811 exited.
Create worker. pid 815
```

实际业务中，worker进程中可能有隐藏的bug导致退出，需要处理，如下所示：

```javascript
// worker.js
var http = require('http')
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('handled by child, pid is ' + process.pid + '\n')
})

var worker
process.on('message', function (m, tcp) {
  if (m === 'server') {
    worker = tcp
    worker.on('connection', function (socket) {
      server.emit('connection', socket)
    })
  }
})

process.on('uncaughtException', function () {
  // 停止接收新的连接
  worker.close(function () {
    // 所有连接断开后，退出进程
    process.exit(1) // 1 表示非正常退出
  })
})
```

上面的做法存在的问题是在极端的情况下，所有工作进程都停止接收新的连接，全处在等待退出的状态，在等到进程完全退出再重启的过程中，可能会丢掉大部分的请求。


### 自杀信号
为此可以在进程退出前发送一个信号给主进程，通知主进程新建一个进程，然后在关闭连接：

```javascript
// worker.js
...
process.on('uncaughtException', function () {
  process.send({act: 'suicide'})
  // 停止接收新的连接
  worker.close(function () {
    // 所有连接断开后，退出进程
    process.exit(1) // 1 表示非正常退出
  })
})
...
// master.js
...
var worker = fork(__dirname + '/worker.js')
// 监听子进程自杀信号
worker.on('message', function (message) {
if (message.act === 'suicide') {
  createWorker()
}
})
...
```

为了测试，将工作进程的处理代码改为抛出异常：

```javascript
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('handled by child, pid is ' + process.pid + '\n')
  throw new Error('throw exception')
})
```

测试：

```
Worker 879 exited.
Create worker. pid 883
```

上面的代码还有两个小点需要解决：

1. 等待长连接的断开可能需要比较久的时间，需要设置一个超时时间强制退出
2. 需要打印未捕获的异常来帮我们定位问题

```javascript
process.on('uncaughtException', function () {
  // 记录日志
  // logger.error(err)
  // 发送自杀信号
  process.send({act: 'suicide'})
  // 停止接收新的连接
  worker.close(function () {
    // 所有连接断开后，退出进程
    process.exit(1) // 1 表示非正常退出
  })
  // 5秒后强制退出
  setTimeout(function () {
    process.exit(1)
  }, 5000)
})
```

这里还有一个细节，就是在关闭服务器之前，后续新接收的request全部关闭keep-alive特性，通知客户端不需要再与服务器保持socket连接了：

```javascript
server.on('request', function (req, res) {
    req.shouldKeepAlive = false;
    res.shouldKeepAlive = false;
    if (!res._header) {
        res.setHeader('Connection', 'close');
    }
});
```

### 限量重启
工作进程不能无限制的重启，有可能是代码本身有bug导致的重启，这种重启是没有必要的。为此，需要进行判断：

```javascript
// 重启次数
var limit = 10
// 时间单位
var during = 60000
var restart = []
var length = 0
var isTooFrequently = function () {
  // 记录重启时间
  var time = Date.now()
  length = restart.push(time)
  console.log(restart)
  if (length > limit) {
    // 取出最后10个记录
    restart = restart.slice(limit * -1)
  }
  // 最后一次重启到前10次重启之间的时间间隔
  return restart.length >= limit && restart[restart.length - 1] - restart[0] < during
}

var workers = {}
var createWorker = function () {
  // 检查是否太过频繁
  if (isTooFrequently()) {
    // 触发giveup事件后，不再重启
    process.emit('giveup', length, during)
    return
  }
  ...
}
```

## 负载均衡
node默认提供的机制是抢占式策略。即在一堆工作进程中，闲着的进程对到来的请求进行争抢，谁抢到谁服务。像这样多个进程之间竞争accpet连接，即是所谓的**惊群现象**。

一般来说，这种抢占式策略是公平的，但是对于node而言，需要分清的是它的繁忙是由CPU，I/O两个部分构成的，影响抢占的是CPU的繁忙度。对不同的业务，可能存在I/O繁忙，而CPU较为空闲的情况，这可能造成某个进程能够抢到较多请求，形成负载不均衡的情况。

为此，node中提供了一种Round-Robin，又叫轮询调度的策略，分发的策略是在N个进程中，每次选择第i=(i+1) mod n个进程来发送连接，在cluster模块中启用它的方式如下：

```javascript
// 启用Round-Robin
cluster.schedulingPolicy = cluster.SCHED_RR
// 不启用
cluster.schedulingPolicy = cluster.SCHED_NONE
```

下面是一个简单的示例

```javascript
// master.js
const net = require('net');
const fork = require('child_process').fork;

var workers = [];
for (var i = 0; i < 4; i++) {
  workers.push(fork('./worker'));
}

var handle = net._createServerHandle('0.0.0.0', 3000);
handle.listen();
handle.onconnection = function (err,handle) {
  var worker = workers.pop();
  worker.send({},handle);
  workers.unshift(worker);
}
// worker.js
const net = require('net');
process.on('message', function (m, handle) {
  start(handle);
});

var buf = 'hello Node.js';
var res = ['HTTP/1.1 200 OK','content-length:'+buf.length].join('\r\n')+'\r\n\r\n'+buf;

function start(handle) {
  console.log('got a connection on worker, pid = %d', process.pid);
  var socket = new net.Socket({
    handle: handle
  });
  socket.readable = socket.writable = true;
  socket.end(res);
}
```

## 状态共享
解决数据共享最直接、最简单的方式是通过第三方来进行数据存储，比如将数据存放到数据库、磁盘、缓存服务（Redis）中。但是这种方式的问题是：如果数据发生改变，还需要一种机制通知到各个子进程，使得他们的内部状态也得到更新。

一种方式是各个子进程去第三方定时轮询，这种做法的尴尬之处是无法很好的设置一个轮询的时间间隔。如果太密，当子进程太多时，会形成并发处理，若是数据没有改变，这些轮询就白白浪费了。如果太长，就不够及时。

另一种方式是，单独启动一个进程，由他来轮询数据，当数据更新时，由他来通知各进程。虽然还是轮询，但是轮询的进程只有一个了。当进程不在一个机器上时可以通过TCP或UDP来进行通知。

# Cluster模块
上面所提到的问题，在nodejs的cluster模块都能得到解决，提供了完善的api。一个示例：

```javascript
var cluster = require('cluster')
var http = require('http')
var cpus = require('os').cpus()

if (cluster.isMaster) {
  for (var i = 0; i < cpus.length; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died')
  })
} else {
  http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.end('handled by child, pid is ' + cluster.worker.process.pid + '\n')
  }).listen(8000)
}
```

测试如下：

```
youxingzhideMac-mini:~ ayou$ curl localhost:8000
handled by child, pid is 1270
youxingzhideMac-mini:~ ayou$ curl localhost:8000
handled by child, pid is 1271
youxingzhideMac-mini:~ ayou$ curl localhost:8000
handled by child, pid is 1272
youxingzhideMac-mini:~ ayou$ curl localhost:8000
handled by child, pid is 1269
```

其工作原理如下：

cluster在启动时，会在内部启动TCP服务器，在``cluster.fork()``子进程时，会将TCP服务器的socket文件描述符发送给工作进程。如果进程是fork出来的，那么他的环境变量中就存在NODE_UNIQUE_ID，如果工作进程中存在``listen()``监听网络端口的调用，它将拿到该文件描述符，通过SO_REUSEADDR端口重用，从而实现多个子进程共享端口。

上面代码忽而判断isMaster，忽而判断isWorker，可读性较差，可以使用``cluster.setupMaster()``这个API，将主进程和工作进程从代码上完全剥离。

```javascript
// master
const cluster = require('cluster');
cluster.setupMaster({
  exec: 'worker.js',
});
cluster.fork();
// worker
var http = require('http')
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('handled by child, pid is ' + process.pid + '\n')
}).listen(8000)
```


# 总结
本文先简单的回顾了下服务器的发展历程，然后实现了一个简单的node多进程服务器架构，并讨论了相关问题的解决方法，最后大致介绍了下cluster模块。

现在终于大概知道了PM2这个进程管理工具得一些原理了，记得前段时间还在网上找PM2的fork和cluster的区别。

当我们执行``pm2 start app.js``的时候，PM2应该是启动了一个master主进程，而app.js则是由worker进程来执行。如果是fork模式的话，就是启动一个工作进程，master做为其守护进程，当其死掉时会重启一个新的进程。cluster模式则是会启动多个工作进程（数量可以通过-i进行设置），master除了重启新进程外，还负责进行负载均衡。