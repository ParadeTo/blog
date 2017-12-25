---
title: 动态规划-背包问题
date: 2017-12-22 14:23:53
tags:
- 算法
categories:
- 算法
description: 经典背包问题
---

背包问题(Knapsack problem)是一种组合优化的NP完全问题。问题可以描述为：
给定一组物品，每种物品都有自己的重量和价格，在限定的总重量内，我们如何选择，才能使得物品的总价格最高。

# 问题
假设山洞里共有a,b,c,d,e这5件宝物（不是5种宝物），它们的重量分别是2,2,6,5,4，
它们的价值分别是6,3,5,4,6，现在给你个承重为 10 的背包, 怎么装背包，可以才能带走最多的财富。

# 动态规划
## 转化方程
动态规划一个关键的步骤是得到状态转化方程，物体的价值用 v(i) 表示，
重量用 w(i) 表示，f[i, j] 表示将前 i 个物体放入到容量为 j 的背包中的最大价值 (f 是个二维数组)，则有:
```
f[i, j] = max(f[i-1, j-w(i)] + v(i)) 
```
其中， j >= w(i), 0 < i <= n

## 求解方法
动态规划有两种等价的实现方法：

1. 带备忘的自顶向下法。此方法按照自然的递归形式编写过程，但过程中会保存每个子问题的解（通常保存在一个数组或散列表中）。
当需要一个子问题的解时，过程首先检查是否已经保存过此解。如果是，则直接返回保存的值，从而节省了时间；否则，按通常方式计算
这个子问题。

2. 自底向上法。这种方法一般需要恰当定义子问题“规模”的概念，使得任何子问题的求解都只依赖于“更小的”子问题的求解。因而
我们可以将子问题按规模排序，按由小至大的顺序进行求解。当求解某个子问题时，它所依赖的那些更小的子问题都已求解完毕，
结果已经保存。

### 自顶向下方法

```javascript
var v = [6,3,5,4,6]
var w = [2,2,6,5,4]
var c = 10

function big (v, w, c) {
  function _big(v, w, c, f, s) {
    var n = v.length
    if (f[c][n] >= 0) {
      return f[c][n]
    }
    f[c][n] = 0
    for (var i = 0;i < n;i++) {
      var newW = w.slice()
      newW.splice(i, 1)
      var newV = v.slice()
      newV.splice(i, 1)
      if (w[i] > c) {
        return 0
      }
      var maxValue = v[i] + _big(newV, newW, c - w[i], f, s)
      if (f[c][n] < maxValue) {
        f[c][n] = maxValue
        s[c][n] = {v: v[i], w: w[i]}
      }
    }
    return f[c][n]
  }

  var f = []
  var s = []
  for (var i = 0; i <= c; i++) {
    f[i] = []
    s[i] = []
  }
  _big(v, w, c, f, s)

  var n = v.length
  // 从s中得到所选择的物品
  var selected = []
  var i = c
  var j = n
  var sum = 0
  do {
    var thing = s[i][j]
    if (thing) {
      selected.push(thing)
      i -= thing.w
      j--
    }
  } while (thing)

  return {
    maxV: f[c][n],
    selected: selected
  }
}
```



