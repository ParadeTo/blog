---
title: create-react-app 项目生产环境部署之 nginx 配置
date: 2018-04-18 16:38:21
tags:
- react
categories:
- 翻译
description: create-react-app 项目配置 nginx
---

最近新项目中使用了 react 技术栈，部署到生产环境时 nginx 的配置让人抓狂了一阵，究其原因还是对各个配置的意思理解的不清楚。

最终配置文件如下：

```nginx
user  nginx;
worker_processes  1;

events {
  worker_connections  4096;  ## Default: 1024
}

http {
  include  mime.types;
  server {
    listen 8080;
    location /produk-digital/m {
      try_files $uri /produk-digital/m/index.html; # /produk-digital/m/index.html 路径不是真实的文件路径，而是访问的 url 路径
    }
    location = /produk-digital/m/index.html { # 上面的 location 都导流到了这里
      alias /Users/youxingzhi/shopee/sniper/build/index.html; # 这里是真实的文件路径
      access_log              off;
      add_header              Cache-Control "no-cache, no-store";
      expires                 -1;
      etag                    on;
    }
    location /produk-digital/static/ { # 静态文件
      # http://test.com/produk-digital/static/css/main.css
      # 会被解析成
      # /Users/youxingzhi/shopee/sniper/build/static/css/main.css
      # 如果换成 root 则会解析成
      # /Users/youxingzhi/shopee/sniper/build/static/produk-digital/static/css/main.css
      alias                 /Users/youxingzhi/shopee/sniper/build/static/;
      access_log              off;
      etag                    on;
      gzip                    on;
      include                 gzip_params;
    }
  }
}
```
