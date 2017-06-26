---
title: nodejs之bigpipe
date: 2017-06-26 10:24:41
tags:
- nodejs
- bigpipe
categories:
- nodejs
description: nodejs实现的一个bigpipe DEMO
---


> Bigpipe是产生于Facebook公司的前端加载技术，它的提出主要是为了解决重数据页面的加载速度问题。（《深入浅出nodejs》）

# 场景
假设有如下页面：页面主体是文章列表，页面底部为版权所有信息，两者数据均来自服务器端，其中获取文章列表数据比较慢，而获取版权信息数据则相对较快。以往的服务器模型是必须等到两者数据都得到后，再一起返回，然而获取更快的数据其实可以提前返回给客户端进行展示。这就需要使用Bigpipe技术了

这里有个疑问，为什么不用ajax？

网上说Bigpipe相比ajax有3个好处：

1. AJAX 的核心是XMLHttpRequest，客户端需要异步的向服务器端发送请求，然后将传送过来的内容动态添加到网页上。如此实现存在一些缺陷，即发送往返请求需要耗费时间，而BigPipe 技术使浏览器并不需要发送XMLHttpRequest 请求，这样就节省时间损耗。

2. 使用AJAX时，浏览器和服务器的工作顺序执行。服务器必须等待浏览器的请求，这样就会造成服务器的空闲。浏览器工作时，服务器在等待，而服务器工作时，浏览器在等待，这也是一种性能的浪费。使用BigPipe，浏览器和服务器可以并行同时工作，服务器不需要等待浏览器的请求，而是一直处于加载页面内容的工作阶段，这就会使效率得到更大的提高。

3. 减少浏览器发送到请求。对一个5亿用户的网站来说，减少了使用AJAX额外带来的请求，会减少服务器的负载，同样会带来很大的性能提升。

# 实现
## 前端

**html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bagpipe示例</title>
    <script src="https://cdn.bootcss.com/jquery/3.2.1/jquery.min.js"></script>
    <script src="https://cdn.bootcss.com/underscore.js/1.8.3/underscore-min.js"></script>
    <script src="/static/bigpipe.js"></script>
</head>
<body>
    <h2>下面是文章列表：</h2>
    <div id="body"></div>
    <script type="text/template" id="tpl_body">
        <div><%=articles%></div>
    </script>
    <h2>下面是版权所有：</h2>
    <div id="footer"></div>
    <script type="text/template" id="tpl_footer">
        <div><%=copyright%></div>
    </script>
</body>
</html>
<script>
    var bigpipe = new Bigpipe()
    bigpipe.ready("articles", function (data) {
      $("#body").html(_.template($("#tpl_body").html())({articles: data}))
    })

    bigpipe.ready("copyright", function (data) {
      $("#footer").html(_.template($("#tpl_footer").html())({copyright: data}))
    })
</script>
```

**bigpipe.js**
这里的bigpipe其实类似于一个发布/订阅模式：

```javascript
var Bigpipe = function () {
  this.callbacks = {}
}

Bigpipe.prototype.ready = function (key, callback) {
  if (!this.callbacks[key]) {
    this.callbacks[key] = []
  }
  this.callbacks[key].push(callback)
}

Bigpipe.prototype.set = function (key, data) {
  var callbacks = this.callbacks[key] || []
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i].call(this, data)
  }
}
```

## 后端
后端首先是实现了一个简单的路由解析系统：

```javascript
var fs = require('fs')
var path = require('path')
var http = require('http')
var url = require('url')

var routes = {'all': []}
var app = {}

app.use = function (path, action) {
  routes.all.push([pathRegexp(path), action])
}

var methods = ['get', 'put', 'delete', 'post']
methods.forEach(function (method) {
  routes[method] = [];
  app[method] = function (path, action) {
    routes[method].push([pathRegexp(path), action])
  }
})

var pathRegexp = function (path, strict) {
  var keys = []

  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function (_, slash, format, key, capture, optional, star) {
      slash = slash || ''
      keys.push(key)

      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : '')
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)')

  return {
    keys: keys,
    regexp: new RegExp('^' + path + '$')
  }
}

var match = function (pathname, routes, req, res) {
  for (var i = 0; i < routes.length; i++) {
    var route = routes[i]
    // 正则匹配
    var reg = route[0].regexp
    var keys = route[0].keys
    var matched = reg.exec(pathname)
    if (matched) {
      // 抽取具体值
      var params = {}
      for (var i = 0; i < keys.length; i++) {
        var value = matched[i + 1]
        if (value) {
          params[keys[i]] = value
        }
      }
      req.params = params;
      var action = route[1]
      action(req, res)
      return true
    }
  }
  return false
}

http.createServer(function (req, res) {
  var pathname = url.parse(req.url).pathname
  // 将请求方法变为小写
  var method = req.method.toLowerCase()
  if (routes.hasOwnProperty(method)) {
    // 根据请求方法分发
    if (match(pathname, routes[method], req, res)) {
      return;
    } else {
      // 如果路径没有匹配成功，尝试让all()来处理
      if (match(pathname, routes.all, req, res)) {
        return ;
      }
    }
  } else {
    // 直接让all()来处理
    if (match(pathname, routes.all, req, res)) {
      return ;
    }
  }

  // 404
  handle404(req, res)
}).listen(1337, '127.0.0.1')

var handle404 = function (req, res) {
  res.writeHead(404)
  res.end()
}

// 返回bigpipe.js
app.use('/static/bigpipe.js', function (req, res) {
  fs.readFile('./static/bigpipe.js', function (err, file) {
    res.setHeader('Content-Type', 'application/x-javascript')
    res.writeHead(200, "Ok")
    res.end(file)
  })
})
```


然后，匹配路由`/articles`，其中回调函数中首先返回html页面，并模拟两个不同时长的任务，任务完成后向客户端返回不同的js代码，用于触发客户端中对应任务的执行，等到两个任务均完成时终止输出：

```javascript
app.get('/articles', function (req, res) {
  // 输出页面布局
  fs.readFile('./views/index.html', function (err, file) {
    res.setHeader('Content-Type', 'text/html')
    res.writeHead(200, "Ok")
    res.write(file)
  })
  
  // 模拟articles任务
  setTimeout(function () {
    res.write(`<script>bigpipe.set("articles", "好文章")</script>`)
    ep.emit('articles')
  }, 10000)

  // 模拟copyright任务
  setTimeout(function () {
    res.write(`<script>bigpipe.set("copyright", "宇宙无敌有限公司")</script>`)
    ep.emit('copyright')
  }, 2000)

  // 两个任务都结束了则终止输出
  ep.all('copyright', 'articles', function () {
    res.end()
  })
})

```


在浏览器中打开``localhost:1337/articles``，2秒后copyright部分显示出来，然后浏览器一直处于加载中的状态，约8秒后文章列表部分显示出来。