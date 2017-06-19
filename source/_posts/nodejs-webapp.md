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
var mine = function (req) {
  var str = req.headers['content-type'] || ''
  return str.split(';')[0]
}

var handle = function(req, res) {
  if (mine(req) === 'application/json') {
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
  if (mine(req) === 'application/json') {
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