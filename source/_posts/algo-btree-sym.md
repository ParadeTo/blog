---
title: 对称二叉树
date: 2017-10-15 21:19:49
tags:
- 算法
categories:
- 算法
description: 对称二叉树
---

如果一棵二叉树和它的镜像一样，那么它是对称的。例如

```javascript
     8
   /   \
  6     6
 / \   / \
5   7 7   5 
```

是一棵对称的二叉树

而以下的不是

```javascript
     8
   /   \
  6     6
 /     / \
5      7  5 
```

结构不对称

```javascript
      8
    /   \
  6      6
 / \    / \
5  6    7  5 
```
数值不对称

下面给出判断二叉树是否对称的代码：

```javascript
Tree.prototype.isSymmetrical = function () {
  if (this.root === null) {
    return true
  }
  return this.isMirror(this.root.left, this.root.right)
}

Tree.prototype.isMirror = function (node1, node2) {
  if (node1 === null && node2 === null) {
    return true
  }

  if (node1 === null || node2 === null) {
    return false
  }

  // 左右子节点相同，且左子节点的左子节点和右子节点的右子节点对称
  return node1.label === node2.label ?
    this.isMirror(node1.left, node2.right) && this.isMirror(node1.right, node2.left) :
    false
}
```

而把一个二叉树转换为他的镜像可以按如下操作：

```javascript
Tree.prototype._toMirror = function (node) {
  if (node === null) return
  var tmp = node.left
  node.left = node.right
  node.right = tmp
  this._toMirror(node.left)
  this._toMirror(node.right)
}
```

