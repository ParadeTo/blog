---
title: 单调递增栈（poj 2796）
date: 2017-09-17 19:20:36
tags:
- 算法
categories:
- 算法
description: 单调递增栈的应用
---

# 题目
给出一个长度为n（n<100000）的序列,求出一个子序列,使得这个序列中的最小值乘以这个序列的和的值最大

# 分析
比如 3 1 6 4 5 2
我们用(a, i, j)这个结构来表示以a为最小值的序列
如(3, 1, 1)表示以3为最小值的序列为3，(1, 1, 6)表示以1为最小值的序列为3 1 6 4 5 2
分析一下这个序列：
1. 3入栈，记为(3, 1, 1)
2. 由于1小于3，3不可能继续往右拓展，所以3出栈(最大值MAX = 3)。1入栈，且1可以向左拓展，记为(1, 1, 2)
3. 6>1, 入栈，栈更新为(1, 1, 2) (6, 3, 3)
4. 4<6, 6出栈(以6为最小值的结果为6，大于3，更新MAX=6)，栈更新为(1, 1, 3) (4, 3, 4)
5. 5>4, 入栈，栈更新为(1, 1, 3) (4, 3, 4) (5, 5, 5)
6. 2<5, 5出栈(MAX仍为6)，栈更新(1, 1, 3) (4, 3, 5),   (2, 6, 6)更新为(2, 5, 6)
7. 2<4, 4出栈(MAX=60), 栈更新(1, 1, 5),   (2, 5, 6)更新为(2, 3, 6)
8. 2>1, 2入栈， 栈更新(1, 1, 5) (2, 3, 6)
9. 2出栈(计算比较得到MAX仍为60)，栈更新(1, 1, 6)
10. 1出栈(计算比较得到MAX仍为60)

# 代码
```javascript
function calcSum(arr, item) {
  return item.value * arr.slice(item.start, item.end + 1).reduce(function(a, b) {
    return a + b
  })
}

function max(arr) {
  var stack = []
  var max = -Infinity
  var maxItem
  var top
  for (var i = 0; i < arr.length; i++) {
    top = stack[stack.length - 1]
    var item = {
      value: arr[i],
      start: i,
      end: i
    }
    while(top && top.value > item.value) {
      var popItem = stack.pop()
      var sum = calcSum(arr, popItem)
      if (sum > max) {
        max = sum
        maxItem = popItem
      }

      item.start = popItem.start
      if (stack[stack.length - 1]) stack[stack.length - 1].end = popItem.end
      top = stack[stack.length - 1]
    }
    stack.push(item)
  }

  var top = stack[stack.length - 1]
  while(top) {
    var popItem = stack.pop()
    var sum = calcSum(arr, popItem)
    if (sum > max) {
      max = sum
      maxItem = popItem
    }
    if (stack[stack.length - 1]) stack[stack.length - 1].end = popItem.end
    top = stack[stack.length - 1]
  }
  return {
    max: max,
    start: maxItem.start,
    end: maxItem.end
  }
}

console.log(max([3, 1, 6, 4, 5, 2]))
// 结果
// { max: 60, start: 2, end: 4 }
```
