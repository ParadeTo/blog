---
title: 最大子序列应用－最大在线人数
date: 2017-03-19 17:31:23
tags:
- 算法
- 最大子序列
categories:
- 算法
description: 运用最大子序列应用求解最大在线人数
---

# 题目
假设有一个论坛，每个ID从登陆到退出会向一个日志文件中记下登陆时间和退出时间 (按时间顺序记录)，
要求写一个算法统计一天中同时在线人数最多的时间段，日志文件如下所示：

[十进制unix时间戳] | [ID] | [事件类型] 

1488881338 | abcdefghijk | 1

1488881338 | zyxwvutsu | 1

1488881501 | zyxwvutsu | -1

1488881622 | abcdefghijk | -1

其中，1表示登录，－1表示下线。

从上面的日志文件可看到1488881338～1488881501时间段，为最大在线人数时间段，且在线人数为2。

# 分析
根据日志的格式，我们按时间顺序把事件类型排序得到一个序列，找到一个和最大的子序列，
就表示在这个阶段``上线人数－下线人数``最大，该阶段的和即为最大的在线人数。且从该子序列
的末尾R开始是最大在线人数的起始点，下一个记录R+1为结束点。

# JS实现
```javascript
var arr = [];
// 初始化数据
var fs = require('fs');
var content = fs.readFileSync('./log.txt','utf-8');
var lines = content.split('\r\n');
for (var i = 0 ; i < lines.length; i++) {
    var tmp = lines[i].split(' ');
    arr.push({
        ts: parseInt(tmp[0]),
        // 登录操作记为1，下线操作记做-1，则从最大子序列的末尾时间戳到下一个下线操作的时间戳之间为在线人数最多时间段
        val: parseInt(tmp[2]) === 0 ? 1 : -1
    });
}

function maxSubArr(arr) {
    var L, R;
    var i = 0, j = 0, n = arr.length;
    var sumIj = 0;
    var ans = -Infinity;
    while (j < n) {
        // 如果子序列的和为负数，则跳过该子序列
        if (sumIj < 0) i = j, j = j + 1, sumIj = arr[i].val;
        // 否则不断的加
        else sumIj = sumIj + arr[j].val, j = j + 1;
        
        // 如果备选的值大于ans，则把ans更新，同时记录位置
        if (sumIj > ans) ans = sumIj, L = i, R = j - 1;

    }
    return {ans, L, R};
}



var res = maxSubArr(arr);
// 打印最大子序列某位前后5个记录
console.log(arr.slice(res.R-5, res.R+5));
console.log('最大在线人数为：',res.ans);
console.log('最大在线人数时期：',arr[res.R].ts, '-' ,arr[res.R+1].ts);
```

# 结果
```javascript
[ { ts: 1472701532, val: 1 },
  { ts: 1472701532, val: -1 },
  { ts: 1472701532, val: 1 },
  { ts: 1472701532, val: -1 },
  { ts: 1472701532, val: 1 },
  { ts: 1472701532, val: 1 }, // 这里为最大子序列的末尾
  { ts: 1472701532, val: -1 },
  { ts: 1472701532, val: -1 },
  { ts: 1472701532, val: 1 },
  { ts: 1472701532, val: -1 } ]
最大在线人数为： 504616
最大在线人数时期： 1472701532 - 1472701532
```
可以看到这个最大的在线人数仅仅保持了"片刻"!

