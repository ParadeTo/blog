---
title: CSS SECRETS
date: 2017-08-14 22:17:47
tags: 
- css
categories:
- 读书笔记
description: CSS SECRETS 很有名的css经典著作
---
# 引言
## 编码技巧
* currentColor 文本的颜色

## 背景与边框
### 半透明边框
```css
div {
    padding: 50px;
    border: 10px solid rgba(255,255,255,0.5);
    background: red;
    background-clip: padding-box; // 保留padding的背景
}
```
### 多重边框
#### box-shadow
```css
box-shadow: 0 0 0 10px #655, 0 0 0 20px red;
```

* 不会影响布局，可通过内边距或外边距来模拟
* 不会影响鼠标事件，可以通过inset关键字加上内边距来实现
* 只能产生实线

#### outline
* 可以通过`outline-offset`来指定与边缘的距离，可以为负值
* 没有圆角

