---
title: 模拟实现十大热门搜索
date: 2017-03-23 18:57:38
tags:
- 算法
- 搜索
- 字典树
- 堆
categories:
- 算法
description: 模拟实现类似百度、google的十大热门搜索
---

# 十大热门搜索
我们在使用百度或者google搜索时，他们会给我们列出以搜索词为前缀的十大热门搜索词，
现在我们就来一步步实现这个功能。思考了一下，主要分为以下几步：

1. 产生测试数据

2. 根据搜索词来找出以其为前缀的词，前缀匹配

3. 根据第2步的结果，找出前10个词

4. 前端展示

# 1. 产生测试数据

```javascript
var fs = require('fs');

function randomString(len) {
  len = len || 32;
  var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  var maxPos = $chars.length;
  var pwd = '';
  for (i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return pwd;
}


/**
 * 每一轮生成一个随机字符串，然后生成一系列[0,_l]的子串 _l < l
 * 每个子串输出_n次 _n < n
 * 每一轮输出不超过N条
 * @param N 每次生成的行数
 * @param n 字符串最大输出次数
 * @param l 字符串最大长度
 * @params t 轮数
 */
function genData(N, n, l, t) {
  var writeStream = fs.createWriteStream('./data.csv');
  function _gen(N, n, l) {
    var str = randomString(l);
    var i = 0;
    while (i < N) {
      var _l = Math.floor(Math.random() * l + 1);
      var _n = Math.floor(Math.random() * n + 1);
      var _str = str.substr(0, _l);
      for (var j = 0; j < _n; j++) {
        writeStream.write(_str + '\r\n', "utf-8");
      }
      i += _n;
    }
  }

  for (var i = 0; i < t; i++) {
    _gen(N, n, l);
  }
  writeStream.end();
  writeStream = null;
}


genData(1000, 100, 30, 50);
```

# 2. 前缀匹配
这里我采用了字典树，每个节点记录该节点的字符``ch``以及词频``num``，
在进行前缀匹配的时候将从根节点到当前节点形成的词记录在``prefix``中

```javascript
function TreeNode(ch) {
  this.children = [];
  this.ch = ch;
  this.num = 0; // 词频
};

function TrieTree() {
  this.root = new TreeNode(null);
};

TrieTree.prototype.push = function (str) {
  var p = this.root;
  for (var i = 0; i < str.length; i++) {
    pChildren = p.children;
    for (var j = 0; j < pChildren.length; j++) {
      if (pChildren[j].ch === str[i]) {
        if (i === str.length - 1) p.children[j].num++;
        p = p.children[j];
        break;
      }
    }
    if (j === pChildren.length) break;
  }
  for (; i < str.length; i++) {
    var newChild = new TreeNode(str[i]);
    if (i === str.length - 1) newChild.num++;
    p.children.push(newChild);
    p = newChild;
  }
};

/**
 * 找到str最后一个字符的节点
 * @param str
 * @returns {*}
 */
TrieTree.prototype.search = function (str) {
  var p = this.root;
  var num = 0;
  for (var i = 0; i < str.length; i++) {
    pChildren = p.children;
    for (var j = 0; j < pChildren.length; j++) {
      if (pChildren[j].ch === str[i]) {
        p = p.children[j];
        break;
      }
    }
    if (j === pChildren.length) break;
  }
  if (i === str.length) return p;
  else return null;
};

TrieTree.prototype.prefixSearch = function (str) {
  var p = this.root;
  var res = [];

  var node = this.search(str);

  if (node === null) return [];

  if (node.num > 0) res.push({word: str, num: node.num});

  node.prefix = str;
  res = res.concat(this.bfs(node, str));
  return res;
}

TrieTree.prototype.bfs = function (p) {
  var res = [];
  var que = [];
  que.push(p);
  while (que.length > 0) {
    var node = que.shift();
    for (var i = 0; i < node.children.length; i++) {
      node.children[i].prefix = node.prefix + node.children[i].ch;
      if (node.children[i].num > 0) {
        res.push({word: node.children[i].prefix, num: node.children[i].num});
      }
      que.push(node.children[i]);
    }
  }
  return res;
}

TrieTree.prototype.create = function (filename) {
  var fs = require('fs');
  var content = fs.readFileSync(filename,'utf-8');
  var lines = content.split('\r\n');
  var len = lines.length;
  for (var i = 0 ; i < len; i++) {
    this.push(lines[i]);
  }
}
```

# 3. 根据前缀匹配的结果
找出一个数组（大小为k）的前n个最大值有几种方法，最容易想到的就是排序，
但是其时间复杂度为``O(k*k)``。这里打算借用堆来实现，算法复杂度为``O(k*logn)``：

1. 若是数组大小小于等于n，则直接返回数组
2. 用数组前n个数建立小顶堆
3. 将数组剩下的元素与堆顶元素比较，若是大于堆顶元素，则进行替换，并调整堆为小顶堆
4. 返回堆中所有的元素

```javascript
/**
 * 小顶堆
 * @constructor
 */

function Heap(fn) {
  // 用数组来做堆的内部存储
  this.arr = [];
  // 当前堆的大小
  this.k = 0;
  // 比较函数
  this.fn = fn;
}

Heap.prototype.push = function (ele) {
  // 放到堆尾
  this.arr[this.k++] = ele;
  // 上行到合适位置
  var currentIndex = this.k - 1;
  var parentIndex = Math.floor((currentIndex - 1) / 2);
  while( parentIndex >= 0 && this.fn(this.arr[parentIndex], this.arr[currentIndex]) > 0) {
    var tmp = this.arr[currentIndex];
    this.arr[currentIndex] = this.arr[parentIndex];
    this.arr[parentIndex] = tmp;
    currentIndex = parentIndex;
    parentIndex = Math.floor((currentIndex - 1) / 2);
  }
}

Heap.prototype.pushFront = function (ele) {
  // 与堆顶元素比较，如果比堆顶大，就替换，并向下移动
  if (ele > this.arr[0]) {
    this.arr[0] = ele;
    this.upToDown(0);
  }
}

Heap.prototype.upToDown = function (index) {
  var currentIndex = index;
  while(currentIndex < this.k/2) {
    var lIndex = currentIndex * 2 + 1;
    var rIndex = currentIndex * 2 + 2;
    // 选取左右子树最小者
    var minIndex = 0;
    if (this.fn(this.arr[lIndex], this.arr[rIndex]) < 1) {
      minIndex = lIndex;
    } else {
      minIndex = rIndex;
    }
    // 交换父子
    if (this.fn(this.arr[currentIndex], this.arr[minIndex]) > 0) {
      var tmp = this.arr[currentIndex];
      this.arr[currentIndex] = this.arr[minIndex];
      this.arr[minIndex] = tmp;
      currentIndex = minIndex;
    } else {
      break;
    }
  }
}

Heap.prototype.clean = function() {
  this.k = 0;
  this.arr = [];
}

Heap.prototype.topN = function (arr, n) {
  var len = arr.length;

  this.clean();
  for (var i = 0; i < n && i < len; i++) {
    this.push(arr[i]);
  }

  for (; i < len; i++) {
    this.pushFront(arr[i])
  }
  return this.arr;
}
```

# 4. 前端展示
![](algo-search-topn/1.png)

更多详见[github](https://github.com/ParadeTo/dataguru-algorithm/tree/master/lesson13)



