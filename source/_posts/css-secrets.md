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

# 背景与边框
## 半透明边框
```css
div {
    padding: 50px;
    border: 10px solid rgba(255,255,255,0.5);
    background: red;
    background-clip: padding-box; // 保留padding的背景
}
```
## 多重边框
### box-shadow
```javascript
box-shadow: 0 0 0 10px #655, 0 0 0 20px red;
```

* 不会影响布局，可通过内边距或外边距来模拟
* 不会影响鼠标事件，可以通过inset关键字加上内边距来实现
* 只能产生实线

### outline
* 可以通过`outline-offset`来指定与边缘的距离，可以为负值
* 没有圆角

## 灵活的背景定位
### background-position方案
```javascript
background: url(***) no-repeat bottom right red; /* 回退方案 */
background-position: right 10px bottom 10px;
```

### background-origin + padding方案
```javascript
padding: 10px;
background: url(***) no-repeat red;
background-origin: content-box; /* border-box padding-box(默认) */ 
```

### calc()
```javascript
background-position: calc(100% - 20px) calc(100% - 10px);
```

## 边框内圆角
```javascript
background: tan;
border-radius: .8em;
padding: 1em;
box-shadow: 0 0 0 .6em #655; // 可以根据border-radius计算得到
outline: .6em solid #655;
```

## 条纹背景
比较复杂，看书比较好理解

```javascript
background: linear-gradient(#fb3 33.3%, blue 0, blue 66.7%, red 0); /* 10px:10px:10px 最后面的30%可以写为0*/
background-size: 100% 30px;
```

```javascript
background: #58a;
background-image: repeating-linear-gradient(30deg,
            hsla(0, 0%, 100%, .1),
            hsla(0, 0%, 100%, .1) 15px,
            transparent 0, transparent 30px);
```

## 复杂的背景图案

```javascript
/* 波点 */
background-image:
    radial-gradient(tan 30%, transparent 0),
    radial-gradient(tan 30%, transparent 0);
background-size: 30px 30px;
background-position: 0 0, 15px 15px;
```

```javascript
/* 棋盘 */
background-image:
    linear-gradient(45deg, tan 25%, transparent 0),
    linear-gradient(45deg, transparent 75%, red 0),
    linear-gradient(45deg, blue 25%, transparent 0),
    linear-gradient(45deg, transparent 75%, green 0);
background-size: 30px 30px;
background-position: 0 0, 15px 15px, 15px 15px, 0px 0px;

or

background-image:
    linear-gradient(45deg, tan 25%, transparent 0, transparent 75%, tan 0),
    linear-gradient(45deg, blue 25%, transparent 0, transparent 75%, blue 0);
background-size: 30px 30px;
background-position: 0 0, 15px 15px;
```

## 伪随机背景
“蝉原则”