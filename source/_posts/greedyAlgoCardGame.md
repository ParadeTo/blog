---
title: 贪心算法-卡片游戏
date: 2017-02-18 12:31:23
tags:
- 算法
- 贪心
categories:
- 算法
description: 贪心算法题目
---

# 题目
小明最近宅在家里无聊，于是他发明了一种有趣的游戏，游戏道具是N张叠在一起的卡片，每张卡片上都有一个数字，数字的范围是0~9，游戏规则如下：
首先取最上方的卡片放到桌子上，然后每次取最上方的卡片，放到桌子上已有卡片序列的最右边或者最左边。当N张卡片全部都放到桌子上后，桌子上的N张卡片构成了一个数。这个数不能有前导0，也就是说最左边的卡片上的数字不能是0。游戏的目标是使这个数最小。
现在你的任务是帮小明写段程序，求出这个最小数。


# js解法
```javascript
function getMinNum(str) {
    // 找到最右边最小非0数的位置，该数一定要放到最左边
    var rightMinPos, rightMin=9;
    for (var i=0;i<str.length;i++) {
        if (str[i] != '0' && rightMin >= parseInt(str[i])) rightMin = str[rightMinPos = i];
    }

    // 遍历str
    var ret = str[0];
    for (var i=1;i<str.length;i++) {
        // 最右边最小非0数放到结果的左边
        if (i===rightMinPos) ret = str[i] + ret;
        else if (i < rightMinPos) {
            // 当前数小于第一位，放到左边
            if (str[i] <= ret[0]) ret = str[i] + ret;
            else ret = ret + str[i];
        }
        // 最右边最小非0数右边的数全部放到结果右边
        else ret = ret + str[i];
    }
    return ret;
}

console.log(getMinNum('98754610123'));
console.log(getMinNum('98754610243'));
```
