---
title: css背景图片上添加文字的问题
date: 2016-06-04 09:31:42
tags: 
- css
- html
categories:
- html/css
description: 在css设置的背景图片上添加文字时，文字与图片相对位置不固定的问题解决
---
昨天在做前端页面时，发现这样一个问题。

我给banner设置了背景图片，如下所示：
```css
position: relative;
height: 1148px;
width: 100%;
background: url('/images/portal/portal_letter_bg.png') no-repeat center top;
background-size: cover;
```
需要在背景上添加一些文字，这里我用了绝对定位：
```css
position: absolute;
font-size: 14px;
top: 216px;
left: 460px;
color: #7e7e7e;
```
然后，当我改变浏览器窗口的宽度时，出现了以下现象：
![move-1](css-background-issue/move-1.png)
![move-2](css-background-issue/move-2.png)
出现这个现象的原因是背景容器没有设置固定宽度，导致浏览器窗口宽度发生变化时，背景图片会去自动调整以居中，而文字相对浏览器边框的位置是固定的。

解决办法，增加一个容器，并设置宽度，居中：
```css
position: relative;
margin: 0 auto;
background-color: rgb(1,0,0); // 调试用
opacity: 0.6; // 调试用
width: 980px;
height: 922px;
```
修改后的效果：
![fix-1](css-background-issue/fix-1.png)
![fix-2](css-background-issue/fix-2.png)