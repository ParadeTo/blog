---
title: 最短路径+最小生成树
date: 2017-03-13 20:23:13
tags:
- 算法
categories:
- 算法
description: 最短路径+最小生成树
---

# 两者区别
* 最短路径是解决一个图中从某点出发到图中其他点的最短路径问题

* 最小生成树是解决用最小的代价将图上的所有点连接起来的问题

![](1.jpg)

# js实现

dijkstra实现的最短路径和prim实现的最小生成树代码非常相似：

* dijkstra

```javascript
/**
* S： 起点
* M： 邻接矩阵
*/
function dijkstra(S, M) {
  let D = [];
  let vNum = M.length;
  let result = [], route = [];
  // 初始化
  for (let i = 0; i < vNum; i++) {
    if (i === 0) {
      result[i] = 0;
      route[i] = 0;
    } else {
      result[i] = Infinity;
      route[i] = 0;
    }
    D[i] = M[S][i];
  }
  // 添加剩余的点到T集合
  for (let i = 1; i < vNum; i++) {
    let sp = Infinity;
    let newPoint = -1;
    // 选择V-T中距离起点最近的点添加到V集合中，并记录其到起点的距离
    for (let j = 0; j < vNum; j++)
      if (result[j] === Infinity && D[j] < sp) {
        newPoint = j;
        sp = D[j];
      }
    result[newPoint] = sp;

    // 更新V-T集合中各点到起点的最短距离
    for (let j = 0; j < vNum; j++) {
      if (result[j] === Infinity && D[j] > sp + M[newPoint][j]) {
        D[j] = sp + M[newPoint][j];
        route[j] = newPoint;
      }
    }
  }
  return {result, route};
}
```

* prim

```javascript
/**
* S: 图中任意一点
* M: 邻接矩阵
*/
function prim(S, M) {
    let D = [];
    let vNum = M.length;
    let result = [], route = [];
    // 初始化
    for (let i = 0; i < vNum; i++) {
        if (i === 0) {
            result[i] = 0;
            route[i] = 0;
        } else {
            result[i] = Infinity;
            route[i] = 0;
        }
        D[i] = M[S][i];
    }
    // 添加剩余的点到T集合
    for (let i = 1; i < vNum; i++) {
        let sp = Infinity;
        let newPoint = -1;
        // 选择V-T中距离T最近的点添加到T集合中，并记录其到T的距离
        for (let j = 0; j < vNum; j++)
            if (result[j] === Infinity && D[j] < sp) {
                newPoint = j;
                sp = D[j];
            }
        result[newPoint] = sp;

        // 更新V-T集合中各点到T集合的最短距离
        for (let j = 0; j < vNum; j++) {
            if (result[j] === Infinity && D[j] > M[newPoint][j]) {
                D[j] = M[newPoint][j];
                route[j] = newPoint;
            }
        }
    }
    return {result, route};
}
```

# 补充
## 最小生成树算法图解释
* kruskal
1. 初始化每个顶点为一个树
2. 从小到大考察每一条边，如果这一条边是连接两棵树的边，则将两棵树相连，并
组成新的树。重复这一步骤直到考察完所有的边。
  
![](2.png)

* prim
1. 任意选择一个顶点作为一个"切割"
2. 考察剩余顶点与"切割"的连通情况，选择最小的轻量级边并连接作为新的"切割"。重复这一步骤直到所有的顶点都考察完

![](3.png)

## 单源最短路径
* bellman-ford
1. 初始化各点到起点的距离为无穷大
2. 从起点开始遍历每一个顶点，更新当前遍历顶点的邻居的最短路径信息（前驱和路径长度），直到所有的顶点遍历完

* dijkstra
略

## 多源最短路径
* floyd

http://developer.51cto.com/art/201403/433874.htm


