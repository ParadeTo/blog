---
title: 字典树应用－查找相同url
date: 2017-03-19 12:31:23
tags:
- 算法
- 字典树
categories:
- 算法
description: 运用字典树查找两个文件中相同的
---

# 题目
A文件的含有M行URL的记录，B文件含有N行URL的记录,找出 两个记录里相同的URL,并标记出B文件每个URL在A文件中的位置。


# 分析
初见此题，很容易就会想到采用遍历的方式一条一条去找，那么该方法的时间复杂度为O(M*N)。

若是采用字典树来解决此题，则可以降低时间复杂度：

1 对A进行字典树建树，该过程的时间复杂度为O(M)

2 逐条遍历B中的记录，去字典树中查询，单条url的查询时间复杂度与树的深度有关
，即与url的长度有关，故该过程的时间复杂度为O(1)，则N条记录的时间复杂度为O(N)

由上可得，总时间复杂度为O(M)+O(N)。

同理，当然也可以对B进行建树，逐条查询A中的记录，实际应用中一般是对字典进行建树，这也是字典树的由来。

# JS实现
```javascript
function TreeNode(ch) {
    this.children = [];
    this.ch = ch;
    this.flag = false; // 用于记录该字母是否是单词结尾的标志，此题中的单词为url
};

function TrieTree() {
    this.root = new TreeNode(null);
};

TrieTree.prototype.push = function (str) {
    var p = this.root;
    for (var i = 0; i < str.length; i++) {
        pChildren = p.children;
        // 逐个孩子遍历,看看有没有str[i]匹配的树枝
        for (var j = 0; j < pChildren.length; j++) {
            if (pChildren[j].ch === str[i]) {
                if (i === str.length - 1) p.children[j].flag = true;
                p = p.children[j];
                break;
            }
        }
        if (j === pChildren.length) break;
    }
    for (; i < str.length; i++) {
        var newChild = new TreeNode(str[i]);
        if (i === str.length - 1) newChild.flag = true;
        p.children.push(newChild);
        p = newChild;
    }
};

TrieTree.prototype.search = function (str) {
    var p = this.root;
    var flag = false;
    for (var i = 0; i < str.length; i++) {
        pChildren = p.children;
        for (var j = 0; j < pChildren.length; j++) {
            if (pChildren[j].ch === str[i]) {
                if (pChildren[j].flag) flag = true;
                p = p.children[j];
                break;
            }
        }
        if (j === pChildren.length) break;
    }
    if (i === str.length && flag) return true;
    else return false;
};

var trieTree = new TrieTree();

// 读取B，建立字典
var fs = require('fs');
var contentB = fs.readFileSync('./B.csv','utf-8');
var linesB = contentB.split('\r\n');
for (var i = 0 ; i < linesB.length; i++) {
    trieTree.push(linesB[i]);
}

// 搜索A中的记录
var writeStream = fs.createWriteStream('./ans.csv');
var contentA = fs.readFileSync('./A.csv','utf-8');
var linesA = contentA.split('\r\n');
for (var i = 0 ; i < linesA.length; i++) {
    if(trieTree.search(linesA[i])) {
        writeStream.write(linesA[i]+','+'line:'+(i+1)+'\r\n', "utf-8");
    }
}
writeStream.end();
```