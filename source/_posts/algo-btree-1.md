---
title: 二叉树生成
date: 2017-10-15 21:14:45
tags:
- 算法
categories:
- 算法
description: 二叉树生成
---

二叉树可以由其前序和中序遍历来生成，代码如下：

```javascript
function TreeNode (key, label) {
  this.key = key // 用于区别没一个节点，不能相同
  this.label = label || key // 节点的显示值，可以相同
  this.left = null
  this.right = null
}

function Tree () {
  this.root = null
}

Tree.prototype.treeFromOrdering = function (inorder, preorder) {
  this.root = this._treeFromOrdering(inorder, preorder)
}

Tree.prototype._treeFromOrdering = function (inorder, preorder) {
  if (inorder.length === 0) {
    return null
  }

  var node = new TreeNode(preorder[0].key, preorder[0].label)
  for (var rootIndex = 0; rootIndex < preorder.length; rootIndex++) {
    if (inorder[rootIndex].key === preorder[0].key) {
      break
    }
  }

  var leftInorder = inorder.slice(0, rootIndex)
  var leftPreorder = preorder.slice(1, leftInorder.length + 1)
  node.left = this._treeFromOrdering(leftInorder, leftPreorder)

  var rightInorder = inorder.slice(rootIndex + 1)
  var rightPreorder = preorder.slice(leftInorder.length + 1)
  node.right = this._treeFromOrdering(rightInorder, rightPreorder)

  return node
}
```
