---
title: helmet使用记录
date: 2016-06-17 16:27:18
tags:
- helmet
- nodejs
categories:
- 项目实战
description: helmet使用记录
---
[helmet](https://www.npmjs.com/package/helmet)包含10个中间件:
* contentSecurityPolicy
* dnsPrefetchControl
* frameguard
* hidePoweredBy
* hpkp
* hsts
* ieNoOpen
* noCache
* noSniff
* xssFilter

app.use(helmet())会包括除contentSecurityPolicy,hpkp,noCache以外的其他7个中间件，这里记录下我们搞得比较清楚的

### Content Security Policy
可以防止不受信的内容注入到网站中，可以帮助防御XSS漏洞、恶意frames等（翻译水平有限）
```javascript
app.use(helmet.contentSecurityPolicy({

directives: {
// 默认的资源白名单
defaultSrc: ["'self'", '*.yiqiniu.com', 'hm.baidu.com'],
// 允许的脚本资源：本站点、cdn.bootcss.com、hm.baidu.com、inline资源（常见的style属性,onclick,inline js和inline css等等）
scriptSrc: ["'self'", 'cdn.bootcss.com', 'hm.baidu.com', "'unsafe-inline'"],
// 允许的样式文件资源
styleSrc: ["'self'", "'unsafe-inline'", 'hm.baidu.com'],
// 允许的图片文件资源，因为我们要上传图片到非本站的服务器，所以添加了类似*.yiqiniu.com:*这样的描述，否则无法访问上传后的图片
imgSrc: ["'self'", 'data:', '*.yiqiniu.com:*', '*.91qiyebao.com:*', 'hm.baidu.com', 'http://*.yiqiniu.com:*'],
// 不太清楚
sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-top-navigation', 'allow-popups'],
// 违反上述规则后发送错误报告到下面路由
reportUri: '/report-violation',

objectSrc: []

},

// 设为true后上述的规则不起作用，只会打印出信息
reportOnly: false,

//如果设置true, 将会添加已经被抛弃的兼容头部 X-WebKit-CSP, and X-Content-Security-Policy

setAllHeaders: false,

disableAndroid: false,

browserSniff: true

}));
```
### Dns Prefetch Control
[控制DNS预读](http://www.cnblogs.com/dodohua/archive/2011/03/10/1980110.html)
### Frameguard
可以设置X-Frame-Options用于限定谁可以将自己的站点放置在frame中，从而可以帮助防止[点击劫持](http://baike.baidu.com/link?url=2cbsFZAUhJG2BP_sVnA7PKxrUjLKGPVW0J9GEJEQKhIucxiamtl3hAUlQgHBR479nMoHx6CX4HUdCWcs5n4wya)
### Hide Powered By
隐藏网站的版权者，一般会默认显示制作网站的编程语言，这会给黑客提供一个有用的信息，使用这个可以隐藏掉这一信息，甚至还可以伪造一个。
### hpkp
用来防范由“伪造或不正当手段获得网站证书”造成的中间人攻击[HTTP Public Key Pinning 介绍](http://blogread.cn/it/article/8037?f=nr)
### hsts
Strict-Transport-Security(严格传输安全)
参考[这里](/2016/06/17/hsts/)
### ieNoOpen
设置X-Download-Options头为noopen以阻止IE浏览器用户执行下载
### noCache
告诉浏览器不缓存资源，相当于
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```
### noSniff
禁止浏览器嗅探文件类型，防止基于文件类型混淆的冲击。在低版本IE浏览器中，不会加载未知类型的资源。我们在使用这个时，导致登录时的图片验证码([CCAP](https://www.npmjs.com/package/ccap))无法显示，解决办法：
```
var isjpeg = (os.platform() == 'linux')? 1 : 0;
//判断是否启用jpeg,如果是为win32则只能使用bmp
if (isjpeg) {  
  res.set('Content-Type', 'image/jpeg');
} else {  
  res.set('Content-Type', 'image/bmp');
}
res.end(buffer);
```
### xssFilter
由IE最先提出，浏览器会在检测到有xss威胁时，自动修改页面做出相应的修改
