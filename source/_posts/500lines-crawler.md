---
title: 500行或更少系列之爬虫
date: 2018-01-08 15:22:18
tags:
- python
categories:
- python
description: 用500行左右的代码实现一个爬虫
---

# 引言
经典的计算机科学强调的是高效的算法，能够尽可能快地完成计算。但是许多联网的程序并没有耗时在计算上面，而是打开许多慢的连接，或者是不常发生的事件。这些程序提出了一个不同的挑战：有效地等待大量的网络事件。针对这个问题的一种现代方法是异步 I/O 或 async。

本章介绍了一个简单的网络爬虫。爬虫是一个天生异步应用程序，因为它等待许多响应，但很少进行计算。它能同时读取的页面越多，它完成的时间就越快。如果它为每个请求分配一个线程，那么当并发请求的数量上升时，它会在耗尽套接字之前先耗尽内存或其他与线程相关的资源。可以使用异步 I/O 来避免使用线程。

我们分三个阶段展示这个例子。首先，我们展示了一个异步事件循环，并创建了一个使用回调的事件循环的爬行器：它非常高效，但是将它扩展到更复杂的问题会导致无法维护的面条代码。第二，因此，我们展示了 Python 的协同程序是有效的和可扩展的。我们在 Python 中使用生成器函数实现简单的代码。在第三阶段，我们使用 Python 的标准 asyncio 库中的功能完整的 coroutines，并使用异步队列进行协调。


# 任务
一个网络爬虫在一个网站上找到并下载所有的页面，也许是为了存档或索引它们。从根 URL 开始，它获取每个页面，解析出未访问的链接，并将这些链接添加到队列中。当它获取到一个没有未访问链接的页面且队列是空的时，爬虫停止工作。
我们可以通过同时下载多个页面来加快这一进程。当爬虫找到新的链接时，它会在单独的套接字上启动对新页面的同步抓取操作。当它们返回时，它会解析响应，并添加新链接到队列。由于过多的并发会降低性能，所以可能会出现一些收益递减的问题，因此我们限制了并发请求的数量，并将剩余的链接留在队列中，直到完成了一些请求后继续处理。


# 传统的方法
我们如何使爬虫并行运行？传统上，我们会创建一个线程池。每个线程将负责在套接字上一次下载一个页面。例如，从 xkcd.com 下载一个页面：
```python
def fetch(url):
    sock = socket.socket()
    sock.connect(('xkcd.com', 80))
    request = 'GET {} HTTP/1.0\r\nHost: xkcd.com\r\n\r\n'.format(url)
    sock.send(request.encode('ascii'))
    response = b''
    chunk = sock.recv(4096)
    while chunk:
        response += chunk
        chunk = sock.recv(4096)

    # Page is now downloaded.
    links = parse_links(response)
    q.add(links)
```

默认情况下，套接字操作是阻塞的。因此，为了同时下载多个页面，我们需要很多线程。
然而，线程是昂贵的，操作系统对进程、用户或机器可能拥有的线程数量执行各种严格的限制。对于非常大规模的应用程序，有成千上万的连接，该如何处理这种情况呢？

# Async
异步 I/O 框架使用非阻塞套接字在单个线程上执行并发操作。在我们的 async 爬虫中，我们在开始连接服务器之前设置了套接字非阻塞：

```python
sock = socket.socket()
sock.setblocking(False)
try:
    sock.connect(('xkcd.com', 80))
except BlockingIOError:
    pass
```

令人恼火的是，一个非阻塞的套接字会抛出一个连接的异常，即使它正常工作。这个异常复制了底层 C 函数的令人恼火的行为，它将 errno 设置为 EINPROGRESS 来告诉您它已经开始了。
现在我们的爬虫需要一种方法来知道什么时候建立连接，所以它可以发送 HTTP 请求。我们可以简单地循环下去:

```python
request = 'GET {} HTTP/1.0\r\nHost: xkcd.com\r\n\r\n'.format(url)
encoded = request.encode('ascii')

while True:
    try:
        sock.send(encoded)
        break  # Done.
    except OSError as e:
        pass

print('sent')
```
这种方法不仅浪费电力，而且不能有效地等待多个 socket 上的事件。最早，BSD Unix 对这个问题的解决方案是 select。如今，对互联网应用需要处理大量的连接，这导致了类似于 poll 的替代者，然后是在 BSD 上的 kqueue 和 Linux 上的 epoll。这些 api 类似于select，但是在大量的连接上工作得很好。
这些方法有个专用的名词，叫做多路复用，更多请见[IO 多路复用是什么意思？](https://www.zhihu.com/question/32163005)
Python 3.4 的 `DefaultSelector` 使用了系统上可用的最佳函数。可以像下面这样来注册 I/O 事件：

```python
from selectors import DefaultSelector, EVENT_WRITE

selector = DefaultSelector()

sock = socket.socket()
sock.setblocking(False)
try:
    sock.connect(('xkcd.com', 80))
except BlockingIOError:
    pass

def connected():
    selector.unregister(sock.fileno())
    print('connected!')

selector.register(sock.fileno(), EVENT_WRITE, connected)
```

我们忽略了假的错误（上文已说明）并调用了 `selector.register`。传入套接字的文件描述符和一个常量来表示我们正在等待的事件。要在建立连接时被通知，我们传递 EVENT_WRITE：也就是说，我们想知道套接字是何时“可写”的。我们还传递了一个 Python 函数，连接到该事件发生时运行。这样的函数称为回调函数。
我们在一个循环中处理 I/O 通知，当选择器接收到数据时：

```python
def loop():
    while True:
        events = selector.select()
        for event_key, event_mask in events:
            callback = event_key.data
            callback()
```

# 基于回调函数编程
在我们已经构建的 async 框架中，如何构建网络爬虫？即使是一个简单的 url fetcher 也很痛苦。
我们从尚未取回的 url 的全局集合开始，以及我们已经爬取过的 url 集合：

```python
urls_todo = set(['/'])
seen_urls = set(['/'])
```

获取一个页面需要一系列的回调。当套接字连接时，连接的回调触发，并向服务器发送 GET 请求。但它必须等待响应，因此它注册另一个回调。如果当回调触发时，它无法读取完整的响应，它会再次注册，等等。
让我们将这些回调收集到一个 Fetcher 对象中。它需要一个 url、一个 host、 一个套接字对象和一个存放响应字节的地方:

```python
class Fetcher:
    def __init__(self, url, host):
        self.response = b''
        self.url = url
        self.host = host
        self.sock = None
```

通过调用 `Fetcher.fetch` 开始爬取：

```python
def fetch(self):
    global concurrency_achieved
    concurrency_achieved = max(concurrency_achieved, len(urls_todo))

    self.sock = socket.socket()
    self.sock.setblocking(False)
    try:
        self.sock.connect((self.host, 80))
    except BlockingIOError:
        pass
    selector.register(self.sock.fileno(), EVENT_WRITE, self.connected)
```

`fetch` 方法会创建一个 socket 并连接远程的 socket。但是注意，在建立连接之前，方法会返回。它必须返回对事件循环的控制以等待连接。为了理解其中的原因，想象一下我们整个应用程序的结构：

```python
fetcher = Fetcher('/', 'extremevision.com.cn')
fetcher.fetch()

while not stopped:
    events = selector.select()
    for event_key, event_mask in events:
        callback = event_key.data
        callback(event_key, event_mask)
```

所有事件通知都在事件循环中被处理，当调用 select 时。因此，fetch 必须将控制权交给事件循环，以便程序知道套接字是何时连接的。只有这样，循环才能运行连接的回调，该回调是在上面的 fetch 结束时注册的。
这里是连接的实现：

```python
def connected(self, key, mask):
    selector.unregister(key.fd)
    get = 'GET {} HTTP/1.0\r\nHost: {}\r\n\r\n'.format(self.url, self.host)
    self.sock.send(get.encode('ascii'))
    selector.register(key.fd, EVENT_READ, self.read_response)
```

该方法发送一个 GET 请求。实际应用程序将检查 `send` 的返回值，以防整个消息不能同时发送。但我们的请求很小，可以暂不考虑。然后等待响应，当然，它必须注册另一个回调，并将控制权移交给下一个和最后一个回调事件 read_response，处理服务器的回复：

```python
def read_response(self, key, mask):
    global stopped

    chunk = self.sock.recv(4096)  # 4k chunk size.
    if chunk:
        self.response += chunk
    else:
        selector.unregister(key.fd)  # Done reading.
        links = self.parse_links()
        # print(self.response.decode('utf-8'))
        for link in links.difference(seen_urls):
            urls_todo.add(link)
            Fetcher(link, self.host).fetch()

        seen_urls.update(links)
        urls_todo.remove(self.url)
        if not urls_todo:
            stopped = True
        print(self.url)
```

每次选择器看到套接字是“可读的”时，都会执行回调，这意味着两个东西：套接字有数据或关闭。
回调请求从套接字中获取多达 4kb 的数据。如果数据少于 4kb，块将全部接收这些数据。如果数据多于 4kb，块将包含 4kb 的数据 ，而套接字仍然是可读的，因此事件循环在下一个 tick 上再次运行这个回调。当响应完成时，服务器关闭套接字，而 chunk 将是空的。
parse_links 方法(未显示)返回一组 url。我们为每个新 url 启动一个新的 fetcher，并没有并发性限制。基于回调异步编程有这样一个特性：我们不需要对共享数据进行任何的互斥操作，比如当我们添加 url 到 seen_urls 时。
我们添加一个全局 `stopped` 变量，并使用它来控制循环：

```python
while not stopped:
    events = selector.select()
    for event_key, event_mask in events:
        callback = event_key.data
        callback(event_key, event_mask)
```

# Coroutines
可以通过一种称为“协同”的模式，将回调的效率与多线程编程的经典外观结合起来。使用 Python 3.4 的标准 asyncio 库和一个名为 aiohttp 的包，在 coroutine 中获取一个 url 是非常直接的：

```python
@asyncio.coroutine
def fetch(self, url):
    response = yield from self.session.get(url)
    body = yield from response.read()
```

