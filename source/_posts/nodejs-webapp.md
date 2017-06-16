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

