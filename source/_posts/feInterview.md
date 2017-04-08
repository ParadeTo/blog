---
title: 前端面试题汇总
date: 2017-04-08 12:00:20
tags: 
- 面试
categories:
- 前端理论
description: 各种面试题汇总
---

# js

## ES6
1. 分别用ES5和ES6实现函数默认参数
    ```javascript
    function log1(x, y) {
      y = y || 'world'
      console.log(x, y)
    }
    
    function log2(x, y="world") {
      console.log(x, y)
    }
    ```
    问题：当y转换为Boolean类型的值为False时，会有不合理的情况出现
    ```javascript
    log1(1, '') // 1 'world'
    log2(1, '') // 1 ''
    ```