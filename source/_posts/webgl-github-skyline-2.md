---
title: 再爆肝一周，给乞丐版的 GitHub Skyline 加了点“东西”并发布到线上
date: 2022-10-23 21:42:52
tags:
  - webgl
categories:
  - webgl
description: 再爆肝一周，美化了一下乞丐版的 GitHub Skyline 并发布到线上。
---

# 先睹为快

接[上会](/2022/10/17/webgl-github-skyline/)实现了一个乞丐版的 Github Skyline 后，这次又新加了一些东西，虽然不多，但是也肝了一周。

老规矩，先来看下效果：
![](./webgl-github-skyline-2/demo.gif)

主要是加了这些东西：

- 增加了镜面反射，这样看起来就很有质感了
- 增加了点光源，然而图里面效果不明显
- 增加了参数面板，可以调整光源和物体的颜色、光源的位置，可以对点光源进行切换
- 发布到了线上，可以[在线体验](http://www.paradeto.com/webgl-github-map/)

代码地址仍然是[这里](https://github.com/ParadeTo/webgl-park)，下面简单介绍下怎么实现的。

# 镜面反射

上篇文章介绍物体表面反射的光按照如下公式计算：

```bash
反射光颜色=漫反射光颜色+环境反射光颜色
```

但其实还应该加上镜面反射才显得更加自然：

```bash
反射光颜色=漫反射光颜色+环境反射光颜色+镜面反射光颜色
```

而物体上某一个片元的镜面反射光可以这样计算：

[WebGL 3D - Point Lighting](https://webglfundamentals.org/webgl/lessons/webgl-3d-lighting-point.html)

# 如何绘制一个发光的球体

本以为这是一道送分题，这么普遍的需求，随便 Google 一下应该到处都是，结果发现并不是这样。

网上搜索到比较相关的是[这篇文章](https://learnopengl.com/Advanced-Lighting/Bloom)，这篇文章是先将 Webgl 场景中的发光物体提取出来，然后对其进行高斯模糊处理，最后跟原始的场景进行混合。看效果确实不错，但是实在是肝不动了，想找个简单一下的方法。

那继续用 Blender 大法吧，这么成熟的软件搞个发光的物体应该很简单吧。确实如此，按照这个[教程](https://www.youtube.com/watch?v=WTFj9B6eFgk)操作即可：

![](./webgl-github-skyline-2/blender.png)

然后导出 `obj` 格式的文件，按照它给的数据绘制不就 ok 了。但是导出的文件却只有物体本身的信息，没有物体周围那一圈光晕相关的数据。
