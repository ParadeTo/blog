---
title: 为什么我们要使用HTTP Strict Transport Security？（转）
date: 2016-06-17 15:50:41
tags:
- WEB安全
categories:
- 转载
description: HTTP Strict Transport Security (通常简称为HSTS) 是一个安全功能，它告诉浏览器只能通过HTTPS访问当前资源, 禁止HTTP方式。
---
转自：http://www.2cto.com/Article/201505/398588.html

HTTP Strict Transport Security (通常简称为HSTS) 是一个安全功能，它告诉浏览器只能通过HTTPS访问当前资源, 禁止HTTP方式。
## 什么是Strict-Transport-Security
owasp上的一段定义：
```
HTTP Strict Transport Security (HSTS) is an opt-in security enhancement that is specified by a web application through the use of a special response header. Once a supported browser receives this header that browser will prevent any communications from being sent over HTTP to the specified domain and will instead send all communications over HTTPS. It also prevents HTTPS click through prompts on browsers.
The specification has been released and published end of 2012 as RFC 6797 (HTTP Strict Transport Security (HSTS)) by the IETF. (Reference see in the links at the bottom.)
```
一个网站接受一个HTTP的请求，然后跳转到HTTPS，用户可能在开始跳转前，通过没有加密的方式和服务器对话，比如，用户输入http://foo.com 或者直接 foo.com。这样存在中间人攻击潜在威胁，跳转过程可能被恶意网站利用来直接接触用户信息，而不是原来的加密信息。网站通过HTTP Strict Transport Security通知浏览器，这个网站禁止使用HTTP方式加载，浏览器应该自动把所有尝试使用HTTP的请求自动替换为HTTPS请求。
## 我们为什么需要开启Strict-Transport-Security
想想这样一种场景：

有的网站开启了https，但为了照顾用户的使用体验（因为用户总是很赖的，一般不会主动键入https，而是直接输入域名, 直接输入域名访问，默认就是http访问）同时也支持http访问，当用户http访问的时候，就会返回给用户一个302重定向，重定向到https的地址，然后后续的访问都使用https传输,这种通信模式看起来貌似没有问题，但细致分析，就会发现种通信模式也存在一个风险，那就是这个302重定向可能会被劫持篡改，如果被改成一个恶意的或者钓鱼的https站点，然后，你懂得，一旦落入钓鱼站点，数据还有安全可言吗？

对于篡改302的攻击，建议服务器开启HTTP Strict Transport Security功能，这个功能的含义是：当用户已经安全的登录开启过htst功能的网站 (支持hsts功能的站点会在响应头中插入Strict-Transport-Security) 之后，支持htst的浏览器(比如chrome. firefox)会自动将这个域名加入到HSTS列表，下次即使用户使用http访问这个网站，支持htst功能的浏览器就会自动发送https请求（前提是用户没有清空缓存，如果清空了缓存第一次访问还是明文，后续浏览器接收到服务器响应头中的Strict-Transport-Security，就会把域名加入到hsts缓存中，然后才会在发送请求前将http内部转换成https），而不是先发送http，然后重定向到https，这样就能避免中途的302重定向URL被篡改。进一步提高通信的安全性。

比如，https://example.com/ 的响应头含有Strict-Transport-Security: max-age=31536000; includeSubDomains。这意味着两点：
1. 在接下来的一年（即31536000秒）中，浏览器只要向example.com或其子域名发送HTTP请求时，必须采用HTTPS来发起连接。比如，用户点击超链接或在地址栏输入 http://www.example.com/ ，浏览器应当自动将 http 转写成 https，然后直接向 https://www.example.com/ 发送请求。
2. 在接下来的一年中，如果 example.com 服务器发送的TLS证书无效，用户不能忽略浏览器警告继续访问网站。

HSTS可以用来抵御SSL剥离攻击。SSL剥离攻击是中间人攻击的一种，由Moxie Marlinspike于2009年发明。他在当年的黑帽大会上发表的题为“New Tricks For Defeating SSL In Practice”的演讲中将这种攻击方式公开。SSL剥离的实施方法是阻止浏览器与服务器创建HTTPS连接。它的前提是用户很少直接在地址栏输入https:// ，用户总是通过点击链接或3xx重定向，从HTTP页面进入HTTPS页面。所以攻击者可以在用户访问HTTP页面时替换所有https:// 开头的链接为http:// ，达到阻止HTTPS的目的。

HSTS可以很大程度上解决SSL剥离攻击，因为只要浏览器曾经与服务器创建过一次安全连接，之后浏览器会强制使用HTTPS，即使链接被换成了HTTP。

另外，如果中间人使用自己的自签名证书来进行攻击，浏览器会给出警告，但是许多用户会忽略警告。HSTS解决了这一问题，一旦服务器发送了HSTS字段，用户将不再允许忽略警告。
## Strict-Transport-Security的一些不足
用户首次访问某网站是不受HSTS保护的。这是因为首次访问时，浏览器还未收到HSTS，所以仍有可能通过明文HTTP来访问。解决这个不足目前有两种方案：
1. 浏览器预置HSTS域名列表，Google Chrome、Firefox、Internet Explorer和Spartan实现了这一方案。
2. 将HSTS信息加入到域名系统记录中。但这需要保证DNS的安全性，也就是需要部署域名系统安全扩展。截至2014年这一方案没有大规模部署。

由于HSTS会在一定时间后失效（有效期由max-age指定），所以浏览器是否强制HSTS策略取决于当前系统时间。部分操作系统经常通过网络时间协议更新系统时间，如Ubuntu每次连接网络时，OS X Lion每隔9分钟会自动连接时间服务器。攻击者可以通过伪造NTP信息，设置错误时间来绕过HSTS。解决方法是认证NTP信息，或者禁止NTP大幅度增减时间。比如Windows 8每7天更新一次时间，并且要求每次NTP设置的时间与当前时间不得超过15小时
