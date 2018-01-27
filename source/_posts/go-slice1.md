---
title: Go 切片使用注意事项
date: 2018-01-27 09:41:44
tags:
- go
categories:
- go
description: 关于 Go 中切片使用的注意点
---
# 使用append
先看一个例子：

```go
// 创建一个整型切片
// 其长度和容量都是 5 个元素
slice := []int{10, 20, 30, 40, 50}
// 创建一个新切片
// 其长度为 2 个元素,容量为 4 个元素 
newSlice := slice[1:3]
// 使用原有的容量来分配一个新元素
// 将新元素赋值为 60，会改变底层数组中的元素
newSlice = append(newSlice, 60)

fmt.Println(slice, newSlice)
```

输出：
```
[10 20 30 60 50] [20 30 60]
```

下图可以非常形象的说明上述代码的运行原理：

![image.png](https://user-gold-cdn.xitu.io/2018/1/27/16135432d4577d05?w=699&h=362&f=png&s=20836)

仅做一点点小的改变，结果就不一样了：

```go
	// 创建一个整型切片
	// 其长度和容量都是 5 个元素
	slice := []int{10, 20, 30, 40, 50}
	// 创建一个新切片
	// 其长度与容量相同
	newSlice := slice[1:3:3] // 注意这里
	// 使用原有的容量来分配一个新元素
	// 将新元素赋值为 60，会改变底层数组中的元素
	newSlice = append(newSlice, 60)
	// newSlice 的底层数组已经不是 slice 了，这个改变不会影响 slice
	newSlice[0] = 0
	fmt.Println(slice, newSlice, cap(newSlice))
```

以上代码会输出：
```
[10 20 30 40 50] [0 30 60] 4
```

原因在于：当往 `newSlice` 中新增元素的时候，由于其容量不够，`newSlice` 会拥有一个**全新**的底层数组，其容量是原来的两倍（Go 会自动完成这个操作，一旦元素个数超过 1000，增长因子会设为 1.25）

# 使用 `range` 遍历 `slice`
在使用 `range` 遍历 `slice` 的时候，`range` 会创建每个元素的副本，看看这个例子：

```go
	slice := []int{10, 20, 30, 40}
	// 迭代每个元素,并显示值和地址
	for index, value := range slice {
		fmt.Printf("Value: %d Value-Addr: %X ElemAddr: %X\n", value, &value, &slice[index])
	}
```

输出：

```
Value: 10 Value-Addr: C420014060 ElemAddr: C420018080
Value: 20 Value-Addr: C420014060 ElemAddr: C420018088
Value: 30 Value-Addr: C420014060 ElemAddr: C420018090
Value: 40 Value-Addr: C420014060 ElemAddr: C420018098
```

可以看到 `Value-Addr` 跟 `ElemAddr` 的地址是不同的，印证了上面的说法。而每次迭代的变量的地址是相同的，说明迭代过程复用了这个变量，也是一种防止内存浪费的做法。

# 多维切片
创建一个多维切片：
```
// 创建一个整型切片的切片
slice := [][]int{{10}, {100, 200}}
```

其结构可以用下图来表示：
![image.png](https://user-gold-cdn.xitu.io/2018/1/27/16135432d4455d0c?w=766&h=386&f=png&s=16807)

其中第一维可以看成长度为 2，容量为 2 的保存了**切片**类型的切片，第二维则是整形切片。

其他规则则同处理一维切片一样了，比如：

```go
// 为第一个切片追加值为 20 的元素 
slice[0] = append(slice[0], 20)
```

上述操作可以用下图来表示：

![image.png](https://user-gold-cdn.xitu.io/2018/1/27/16135432d45b7f10?w=731&h=382&f=png&s=21466)