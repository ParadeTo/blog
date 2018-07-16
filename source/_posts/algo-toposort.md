---
title: 拓扑排序
date: 2017-11-25 10:45:08
tags:
- 算法
categories:
- 算法
description: 拓扑排序
---

拓扑排序可以解决以下类似的问题：

![](1.png)

算法导论的解决方法如上图所示，个人觉得不是很好理解，下面给出另外一种比较好理解的算法：

1. 选择一个入度为0的顶点并添加到序列顶部
2. 从图中删除此顶点及该顶点的所有出边
3. 重复1，2，直到不存在入度为0的顶点

```javascript
/**
 * Created by ayou on 17/3/11.
 */


function topo(M) {
    var ret = []

    var degree = [];
    var vNum = M.length;

    // 初始化每个顶点的入度为0
    for (var i = 0; i < vNum; i++) {
        degree[i] = 0;
    }

    // 统计每个顶点的入度
    for (var i = 0; i < vNum; i++)
        for (var j = 0; j < M[i].length; j++)
            degree[M[i][j]]++;

    // 统计0入度的点的个数
    var degree0 = 0;
    for (var i = 0; i < vNum; i++)
        if (degree[i] === 0) degree0++;

    for (var k = 0; degree0 > 0; k++) {
        // 找一个入度为0的顶点
        var j = -1;
        for (var i = vNum - 1; i >= 0; i--)
            if (degree[i] == 0) {
                j = i;
                break;
            }

        // 取出此顶点
        ret[k] = j;
        degree[j] = -1;
        degree0--;

        // 取出该顶点的所有边并统计0度顶点数
        for (var i = 0; i < M[j].length; i++) {
            degree[M[j][i]]--;
            if (degree[M[j][i]] === 0) degree0++;
        }
    }
    return ret;
}

var actionList = [
  '内裤',
  '袜子',
  '裤子',
  '鞋',
  '腰带',
  '衬衣',
  '领带',
  '夹克',
  '手表',
]

var V = 9;
var e = [
    [0,2],[0,3],[1,3],[2,4],[2,3],[5,4],[5,6],[6,7],[4,7],[8,null]
];

var M = [];
for (var i = 0; i < V; i++) {
    M[i] = [];
}

// 边集合转为邻接表
for (var i = 0; i < e.length; i++) {
    if(e[i][1] !== null)
        M[e[i][0]].unshift(e[i][1]);
}

// 排序
var sortRes = topo(M)
for (var i = 0; i < sortRes.length; i++) {
  console.log(actionList[sortRes[i]])
}

// 结果
手表
衬衣
领带
袜子
内裤
裤子
腰带
夹克
鞋
```

