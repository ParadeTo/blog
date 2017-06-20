---
title: nodejs之构建Web应用
date: 2017-06-14 09:31:54
tags:
- nodejs
categories:
- nodejs
description: nodejs构建Web应用
---

> 前后端都用js语言的好处：
> 
> * 无须切换语言环境
> * 数据（JSON）可以很好地实现跨前后端直接使用
> * 一些业务（如模板渲染）可以很自由地轻量地选择是在前端还是在后端进行

# 基础功能
以官方经典的Hello World为例：

```javascript
var http = require('http')
http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'}
	res.end('Hello World\n')
}).listen(1337, '127.0.0.1')
```

在具体的业务中，我们可能有如下这些需求：

* 请求方法的判断
* URL的路径解析
* URL中查询字符串解析
* Cookie的解析
* Basic认证
* 表单数据的解析
* 任意格式文件的上传处理

## 请求方法
HTTP_Parser在解析请求报文的时候，将报文头抽取出来，设置为``req.method``

## 路径解析
HTTP_Parser解析为``req.url``

## 查询字符串

## Cookie
请求报文Cookie的格式类似如下：

```javascript
Cookie: foo=bar; baz=val
```

设置Cookie的报文如下所示：

```javascript
Set-Cookie: name=value; Path=/; Expires=Sun, 23-Arp-23 09:01:35 GMT; Domain=.domain.com
```

* path
* Expires/Max-Age
* HttpOnly
* Secure

node设置cookie：

```javascript
res.setHeader('Set-Cookie', 'foo=bar; Path=/; Expires=Sun, 23-Arp-23 09:01:35 GMT; Domain=.domain.com')
or
res.setHeader('Set-Cookie', ['foo=bar; Path=/; Expires=Sun, 23-Arp-23 09:01:35 GMT; Domain=.domain.com', 'baz=val; Path=/; Expires=Sun, 23-Arp-23 09:01:35 GMT; Domain=.domain.com'])
```

## Session
* 基于Cookie实现用户和数据的映射
* 通过查询字符串来实现

**session与安全**
设置Cookie时，将sid通过私钥加密进行签名，把这个签名值作为新的sid：

```javascript
function sign (val, secret) {
	return val + '.' + crypto.createHmac('sha256', secret)
		.update(val).digest('base64').replace(/、=+$/,'')
}
```

验证：

```javascript
function unsign (val, secret) {
	var str = val.slice(0, val.lastIndexOf('.'))
	return sign(str, secret) == val ? str : false
}
```

一种更好的方案是将客户端的某些独有信息与口令作为原值，然后前面，这样攻击者一旦不在原始的客户端上进行访问，就会导致签名失败。这些独有信息包括用户ip和用户代理（User Agent）

## 缓存

* If-Modified-Since/Last-Modified
当服务器返回``Last-Modified``时，下次浏览器请求会自动带上``If-Modified-Since``

```javascript
var handle = function (req, res) {
  fs.stat('./test.js', function (err, stat) {
    var lastModified = stat.mtime.toUTCString()
    if (lastModified === req.headers['if-modified-since']) {
      res.writeHead(304, "Not Modified")
      res.end()
    } else {
      fs.readFile('./test.js', function (err, file) {
        var lastModified = stat.mtime.toUTCString()
        res.setHeader('Last-Modified', lastModified)
        res.writeHead(200, "Ok")
        res.end(file)
      })
    }
  })
}
```

* If-None-Match/ETag

```javascript
var getHash = function (str) {
  var shasum = crypto.createHash('sha1')
  return shasum.update(str).digest('base64')
}

var handle = function (req, res) {
  fs.readFile('./test.js', function (err, file) {
    var hash = getHash(file)
    var noneMatch = req.headers['if-none-match']
    if (hash === noneMatch) {
      res.writeHead(304, "Not Modified")
      res.end()
    } else {
      res.setHeader('ETag', hash)
      res.writeHead(200, "Ok")
      res.end(file)
    }
  })
}

```

* Cache-Control/Expires

略

## Basic认证
在Basic认证中，他会将用户和密码部分组合：``username + ":" + password``。然后进行Base64编码：

```javascript
var encode = function (username, password) {
	return new Buffer(username +　":" + password).toString('base64')
}
```

如果首次访问该页面，URL地址中也没有携带认证内容，服务器会返回401，浏览器会弹出一个登陆的窗口

```javascript
var checkUser = function (user, pass) {
  if (user === 'ayou' && pass === '123456') {
    return true
  }
  return false
}

var authorization = function (req, res) {
  var auth = req.headers['authorization'] || ''
  var parts = auth.split(' ')
  var method = parts[0] || '' // Basic
  var encoded = parts[1] || '' // sxnldglg
  var decoded = new Buffer(encoded, 'base64').toString('utf-8').split(':')
  var user = decoded[0]
  var pass = decoded[1]
  if (!checkUser(user, pass)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
    res.writeHead(401)
    res.end()
  } else {
    handle(req, res)
  }
}
```

# 数据上传
## 表单数据
默认的表单提交，请求头中的``Content-Type``字段为``application/x-www-form-urlencoded``,由于它的报文体跟查询字符串相同：``foo=bar&baz=val``,因此解析起来比较容易：

```javascript
var hasBody = function(req) {
  return 'transfer-encoding' in req.headers || 'content-length' in req.headers  
}

function (req, res) {
  if (hasBody(req)) {
    var buffers = []
    req.on('data', function(chunk) {
      buffers.push(chunk)
    })
    req.on('end', function() {
      req.rawBody = Buffer.concat(buffers).toString()
      handle(req, res)
    })
  } else {
    handle(req, res)
  }
}

var handle = function (req, res) {
  if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
    req.body = querystring.parse(req.rawBody)
  }
}
```

## 其他格式
**JSON文件**

```javascript
var mime = function (req) {
  var str = req.headers['content-type'] || ''
  return str.split(';')[0]
}

var handle = function(req, res) {
  if (mime(req) === 'application/json') {
    try {
      req.body = JSON.parse(req.rawBody)
    } catch (e) {
      res.writeHead(400)
      res.end('Invalid JSON');
      return
    }
  }
  todo(req, res)
}
```

**XML文件**

```javascript
var xml2js = require('xml2js')

var handle = function(req, res) {
  if (mime(req) === 'application/json') {
	xml2js.parseString(req,rawBody, function (err, xml) {
		if (err) {
	      res.writeHead(400)
	      res.end('Invalid XML');
	      return
		}
		req.body = xml
		todo(req, res)
	})
  }
}
```

## 附件上传
```
------WebKitFormBoundaryuNvMBwzIYUQBKoHY
Content-Disposition: form-data; name="username"

fdg
------WebKitFormBoundaryuNvMBwzIYUQBKoHY
Content-Disposition: form-data; name="file"; filename="7.pdf"
Content-Type: application/pdf


------WebKitFormBoundaryuNvMBwzIYUQBKoHY--
```


```javascript
var handle = function (req, res) {
  if (hasBody(req)) {
    if (mime(req) === 'multipart/form-data') {
      var form = new formidable.IncomingForm()
      form.uploadDir = './'
      form.parse(req, function (err, fields, files) {
        console.log(fields, files)
        req.body = fields
        req.files = files
        res.writeHead(200, 'ok')
        res.end('success')
      })
    }
  }
}
```

## 数据上传与安全
**上传大小限制**

```javascript
var bytes = 1024
var limit = function (req, res) {
  var received = 0
  var len = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null

  // 如果有content-length头
  if (len && len > bytes) {
    res.writeHead(413) // 实体过长
    res.end()
    return
  }
  
  req.on('data', function (chunk) {
    received += chunk.length
    if (received > bytes) {
      req.destroy()
    }
  })
}
```

**CSRF**
关于CSRF请查看[CSRF亲测](/2016/06/04/web-csrf/)


# 路由解析
## 文件路径型
略
## MVC
### 路由映射
1.手工映射

```javascript
var http = require('http')
var url = require('url')

var controllers = {
  setting: function (req, res) {
    res.end('setting')
  }
}


var routes = []

var use = function (path, action) {
  routes.push([path, action])
}

use('/user/setting', controllers.setting)
use('/setting/user', controllers.setting)

http.createServer(function (req, res) {
  var pathname = url.parse(req.url).pathname
  for (var i = 0; i < routes.length; i++) {
    var route = routes[i]
    if (pathname === route[0]) {
      var action = route[1]
      action(req, res)
      return
    }
  }
  // 404
  res.writeHead(404)
  res.end()
}).listen(1337, '127.0.0.1')
```

**正则匹配**

```
var use = function (path, action) {
  routes.push([pathRegexp(path), action])
}

var pathRegexp = function (path, strict) {
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function (_, slash, format, key, capture, optional, star) {
      slash = slash || ''
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

  return new RegExp('^' + path + '$')
}
...
for (var i = 0; i < routes.length; i++) {
	var route = routes[i]
	if (route[0].exec(pathname)) {
	  var action = route[1]
	  action(req, res)
	  return
	}
}
...
use('/user/:d/:sdafg', controllers.setting)
use('/setting/:dd/dsasg', controllers.setting)
```

**参数解析**

```
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
...
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
  return
}
...
    
```

2.自然映射

```javascript
var http = require('http')
var url = require('url')


http.createServer(function (req, res) {
  var pathname = url.parse(req.url).pathname
  var paths = pathname.split('/')
  var controller = paths[1] || 'index'
  var action = paths[2] || 'index'
  var args = paths.slice(3)
  var module

  try {
    // require的缓存机制使得只有第一次是阻塞的
    module = require('./controllers/' + controller)
  } catch (e) {
    // 处理500
    return
  }

  var method = module[action]
  if (method) {
    method.apply(null, [req, res].concat(args))
  } else {
    // 500
  }
}).listen(1337, '127.0.0.1')
...
exports.setting = function (req, res, month, year) {
  res.end(month + '/' + 'year')
}
```

## RESTful
通过URL设计资源，通过请求方法定义资源的操作，通过Accept决定资源的表现形式

```javascript
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

app.get('/user/:username', function (req, res) {
  res.end(req.params.username)
})
```

# 中间件