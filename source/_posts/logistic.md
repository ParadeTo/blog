---
title: 机器学习实战-Logistic回归
date: 2017-05-26 17:15:30
tags:
- 机器学习
categories:
- 机器学习
description: 机器学习实战Logistic回归算法
---

Logistic回归进行分类的主要思想是：根据现有数据对分类边界建立回归公式，以此进行分类。

* 优点：计算代价不高，易于理解和实现。
* 缺点：容易欠拟合，分类精度可能不高。
* 适用数据类型：数值型和标称数据。

# 基于Logistic回归和Sigmoid函数的分类
sigmoid函数：

```python
S(z) = 1 / (1+e^-z)
```

当z为0时，其值为0.5；当z增大时，其值逼近于1；当z减小，其值逼近于0.

为了实现Logistic回归，可以在每个特征上乘以一个回归系数，然后把所有的结果值相加，将这个总和代入Sigmoid函数中，得到一个范围在0~1之间的数值。任何大于0.5的数据被分入1类，小于0.5的被分入0类。

如何确定回归系数呢？


# 基于最优化方法的最佳回归系数确定

```python
z = w0x0 + w1x1 + ... + wnxn
```

## 梯度上升法
其思想为：要找到某函数的最大值，最好的方法是沿着该函数的梯度方向探寻。迭代公式：

```python
w := w + a
```