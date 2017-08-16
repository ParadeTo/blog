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

另外，这个：
https://hugogiraudel.com/2013/02/04/css-gradients/#a-few-things-about-linear-gradients

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
“蝉原则”，质数的思想

## 连续的图像边框
```javascript
/* 老式信封样式边框 */
background: linear-gradient(white, white) padding-box,
          repeating-linear-gradient(-45deg,
            red 0, red 12.5%,
            transparent 0, transparent 25%,
            #58a 0, #58a 37.5%,
            transparent 0, transparent 50%) 0 / 5em 5em;
background-origin: border-box;
```


```javascript
/* 蚂蚁行军边框 */
@keyframes ants {
  to {
    background-position: 100%;
  }
}
background: linear-gradient(white, white) padding-box,
          repeating-linear-gradient(-45deg,
            black 0, black 25%,
            white 0, white 50%) 0 / 0.5em 0.5em;
background-origin: border-box;
animation: ants 12s linear infinite;
```


```javascript
/* 脚注 */
.footnote {
	border-top: .15em solid transparent;
	border-image: 100% 0 0 linear-gradient(90deg, currentColor 4em, transparent 0);
	padding-top: .5em;
	font: 220%/1.4 Baskerville, Palatino, serif;
}
```

# 形状
## 自适应的椭圆
```javascript
/* 半椭圆 */
border-radius: 50% / 100% 100% 0 0;
```

## 平行四边形
```javascript
button  {
  width: 200px;
  height: 100px;
  position: relative;
  background: transparent;
  border: none;
}
button::before {
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0;  left: 0;
  z-index: -1;
  background: #58a;
  transform: skew(45deg);
}
```

## 菱形图片
```javascript
.picture {
  margin: 200px auto;
  width: 155px;
  height: 155px;
  transform: rotate(45deg);
  overflow: hidden;
  border: 1px solid gray;
}
.picture > img {
  max-width: 100%;
  transform: rotate(-45deg) scale(1.42);
}
```

更好的方案

```javascript
img:hover {
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}
img {
  transition: 1s clip-path;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
}
```

## 切角效果
四个角的切角效果

```javascript
background: #58a;
background:
	linear-gradient(135deg, transparent 15px, #58a 0) top left,
	linear-gradient(-135deg, transparent 15px, #58a 0) top right,
	linear-gradient(-45deg, transparent 15px, #58a 0) bottom right,
	linear-gradient(45deg, transparent 15px, #58a 0) bottom left;
background-size: 50% 50%;
background-repeat: no-repeat;
```

内凹圆角

```javascript
background:
	radial-gradient(circle at top left, transparent 15px, #58a 0) top left,
	radial-gradient(circle at top right, transparent 15px, #58a 0) top right,
	radial-gradient(circle at bottom left, transparent 15px, #58a 0) bottom left,
	radial-gradient(circle at bottom right, transparent 15px, #58a 0) bottom right;
background-size: 50% 50%;
background-repeat: no-repeat;
```

svg + border-image 的方案
```javascript
background: #58a;
background-clip: padding-box;
border: 15px solid #58a;
/* 1对应svg文件的坐标系统，可以用33.4% */
border-image: 1 url('data:image/svg+xml,\
<svg xmlns="http://www.w3.org/2000/svg"\
  width="3" height="3" fill="%2358a">\
  <polygon points="0,1 1,0 2,0 3,1 3,2 2,3 1,3 0,2"/>\
</svg>')
```

裁切路径方案
```javascript
clip-path: polygon(
	20px 0, calc(100% - 20px) 0, 100% 20px,
	100% calc(100% - 20px), calc(100% - 20px) 100%,
	20px 100%, 0 calc(100% - 20px), 0 20px
);
```

## 梯形标签页
```javascript
div::before {
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  z-index: -1;
  background: #ccc;
  background-image: linear-gradient(hsla(0, 0%, 100%, .6), hsla(0, 0%, 100%, 0));
  border: 1px solid rgba(0, 0, 0, .4);
  border-bottom: none;
  border-radius: 1em 1em 0 0;
  box-shadow: 0 .15em white inset;
}

#div1:before {
  transform: perspective(.5em) scaleY(2) rotateX(5deg);
  transform-origin: bottom;
}

#div2:before {
  transform: perspective(0.5em) scaleY(2) rotateX(5deg);
  transform-origin: bottom left;
}

#div3:before {
  transform: perspective(0.5em) scaleY(2) rotateX(5deg);
  transform-origin: bottom right;
}
```

## 饼图