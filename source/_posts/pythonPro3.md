---
title: python3程序开发指南(第二版)第三章
date: 2017-05-23 22:39:19
tags:
- python
categories:
- 读书笔记
description: python3程序开发指南(第二版)第三章-组合数据类型
---

# 序列类型
* bytearray
* bytes
* list
* str
* tuple

## 元组
* 有序序列
* 支持与字符串一样的分片与步距
* 固定，不能修改，可以先使用``list()``转换为列表再修改
* tuple()
	* 无参数，返回空元组
	* 元组作为参数，返回浅拷贝
	* 其他参数，尝试进行转换
* 两种方法
	* count(x) 返回某个元素出现的次数
	* index(x) 返回某个元素的索引
* 操作符``+ * []``(虽然元组是固定对象)，其实是python创建了新元组，用于存放结果，然后将左边的对象引用设置为指向新元素
* 为特定的索引位置指定名字

	```python
	>>> MANUFACTURER, MODEL, SEATING = (0, 1, 2)
>>> MINIMUM, MAXIMUM = (0,1)
>>> aircraft = ('Airbus', 'A320-200', (100, 220))
>>> aircraft[SEATING][MAXIMUM]
220
	```
* 可以用于两个变量交换

	```python
	a, b = (b, a)
	```	
	
## 命名的元组
