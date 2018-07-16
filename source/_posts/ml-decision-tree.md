---
title: 机器学习实战-决策树
date: 2017-05-22 15:06:47
tags:
- 机器学习
categories:
- 机器学习
description: 机器学习实战之决策树算法
---

决策树的概念非常简单，即使不知道它也可以通过简单的图形了解其工作原理，下图就是一个简单的决策树：

![](decisionTree1.png)

* 优点：计算复杂度不高，输出结果易于理解，对中间值的缺失不敏感，可以处理不相关特征数据。
* 缺点：可能会产生过度匹配问题。
* 适用数据类型：数值型和标称型。

# 数据
下表包含5个海洋动物，有两个特征：不浮出水面是否可以生存，是否有脚蹼，分成两类：鱼类和非鱼类

|不浮出水面是否可以生存(No Surfacing?)|是否有脚蹼(Flippers?)|是否是鱼类|
|-----|-----|-----|
|是|是|是|
|是|是|是|
|是|否|否|
|否|是|否|
|否|是|否|


# 决策树的构造
决策树构造可以用下面伪代码来表示：
```python
def createBranch():
	if so return 类标签；
	else
		寻找划分数据集的最好特征
		划分数据集
		创建分支节点
			for 每个划分的子集
				调用函数createBranch()并增加返回结果到分支节点中
		return 分支节点
```

本文使用ID3算法划分数据集，该算法处理如何划分数据集及何时停止划分数据集。

我们应该选择哪个特征作为划分的参考属性呢？

## 信息增益
划分数据集前后信息发生的变化称为信息增益，一般用香农熵来度量。熵定义为信息的期望值：

```
H=-Sum(i=1=>n)(p(xi)log2p(xi))
```

如何理解：

假设现在待分数据集有两类，其熵H大于0，经过第一次分类后，分成的两类中刚好n都为1，即分类后的熵为0，此时的信息增益即为H。其实这里说成“信息减益”更合适，我们就是要找到使得分类后信息越少的属性进行分类。

计算信息熵的代码：

```python
from math import log

def calcShannonEnt(dataSet):
    numEntries = len(dataSet)
    labelCounts = {}
    for featVec in dataSet: #the the number of unique elements and their occurance
        currentLabel = featVec[-1]
        if currentLabel not in labelCounts.keys(): labelCounts[currentLabel] = 0
        labelCounts[currentLabel] += 1
    shannonEnt = 0.0
    for key in labelCounts:
        prob = float(labelCounts[key])/numEntries
        shannonEnt -= prob * log(prob,2) #log base 2
    return shannonEnt
```

测试不同数据的熵大小

```python
print tree.calcShannonEnt([
            [1, 1, 'yes'],
            [1, 1, 'yes'],
            [1, 0, 'no'],
            [0, 1, 'no'],
            [0, 1, 'no']])

print tree.calcShannonEnt([
            [1, 1, 'yes'],
            [1, 1, 'yes'],
            [1, 0, 'yes'],
            [0, 1, 'yes'],
            [0, 1, 'yes']])
...
0.970950594455
0.0

```

由结果可见之前的分析是对的

## 划分数据集
从原始数据中根据某特征划分出特定的数据子集的代码如下：
```python
def splitDataSet(dataSet, axis, value):
    """
    划分数据集
    dataSet = 
    [[1, 1, 'yes'],
    [1, 1, 'yes'],
    [1, 0, 'no'],
    [0, 1, 'no'],
    [0, 1, 'no']]
    axis = 0
    value = 1
    =>
    [[1, 'yes'], [1, 'yes'], [0, 'no']]
    
    :param dataSet: 元素数据
    :param axis: 划分的属性下标
    :param value:  所要提取的属性值
    :return:
    """
    retDataSet = []
    for featVec in dataSet:
        if featVec[axis] == value:
            reducedFeatVec = featVec[:axis]     #chop out axis used for splitting
            reducedFeatVec.extend(featVec[axis+1:])
            retDataSet.append(reducedFeatVec)
    return retDataSet
```

有了上述代码，现在可以选择最好的数据集划分方式了：

```python
def chooseBestFeatureToSplit(dataSet):
    """
    输入：
        [[1, 1, 'yes'], [1, 1, 'yes'], [1, 0, 'no'], [0, 1, 'no'], [0, 1, 'no']]
    """
    numFeatures = len(dataSet[0]) - 1      #the last column is used for the labels
    baseEntropy = calcShannonEnt(dataSet)
    bestInfoGain = 0.0; bestFeature = -1
    for i in range(numFeatures):        
        """
            属性的向量
            i=0时
            featList = [1, 1, 1, 0, 0]
        """
        featList = [example[i] for example in dataSet]
        uniqueVals = set(featList)       
        newEntropy = 0.0
        # 计算划分后每个子类的信息增益然后再求他们的算术平均和
        for value in uniqueVals:
            subDataSet = splitDataSet(dataSet, i, value)
            prob = len(subDataSet)/float(len(dataSet))
            newEntropy += prob * calcShannonEnt(subDataSet)
        infoGain = baseEntropy - newEntropy     
        
        # 得到信息增益最大的那个属性
        if (infoGain > bestInfoGain):       
            bestInfoGain = infoGain         
            bestFeature = i
    return bestFeature   
```


## 递归构建决策树
基于最好的属性值划分数据集，划分之后，数据将被向下传递到树分支的下一个节点，在这个节点上，递归再次划分数据。直到程序遍历完所有划分数据集的属性或者每个分支下的所有实例都具有相同的分类。

如果处理完所有属性后类标签依然不是唯一的，则采取多数表决的方法决定叶子节点的分类：

```python
def majorityCnt(classList):
    classCount={}
    for vote in classList:
        if vote not in classCount.keys(): classCount[vote] = 0
        classCount[vote] += 1
    sortedClassCount = sorted(classCount.iteritems(), key=operator.itemgetter(1), reverse=True)
    return sortedClassCount[0][0]
```

有了以上代码，可以得到创建树的代码如下：

```python
def createTree(dataSet,labels):
    """

    :param dataSet: 最后一列是分类标签
    :param labels: 每一列的列名
    :return:
    """
    classList = [example[-1] for example in dataSet]
    # 全为一类则返回类标签
    if classList.count(classList[0]) == len(classList):
        return classList[0]
    # 只剩标签列，则返回多数表决的结果
    if len(dataSet[0]) == 1:
        return majorityCnt(classList)

    bestFeat = chooseBestFeatureToSplit(dataSet)
    bestFeatLabel = labels[bestFeat]
    myTree = {bestFeatLabel:{}}
    del(labels[bestFeat])
    featValues = [example[bestFeat] for example in dataSet]
    uniqueVals = set(featValues)
    for value in uniqueVals:
        subLabels = labels[:]       #copy all of labels, so trees don't mess up existing labels
        myTree[bestFeatLabel][value] = createTree(splitDataSet(dataSet, bestFeat, value),subLabels)
    return myTree
```

还是用刚才的数据测试

```python
print tree.createTree([
            [1, 1, 'yes'],
            [1, 1, 'yes'],
            [1, 0, 'no'],
            [0, 1, 'no'],
            [0, 1, 'no']],['No Surfacing?', 'Flippers?'])

...

{'No Surfacing?': {0: 'no', 1: {'Flippers?': {0: 'no', 1: 'yes'}}}}
```

# 测试算法
基于上面的分类树，可以得到分类函数如下：

```python
def classify(inputTree, featLabels, testVec):
    """
    :param inputTree: 分类树
    :param featLabels: 属性的标签名数组
    :param testVec: 待分类的向量
    :return:
    """
    firstStr = inputTree.keys()[0]
    secondDict = inputTree[firstStr]
	# 根据属性的标签名得到其索引
    featIndex = featLabels.index(firstStr)
    key = testVec[featIndex]
    valueOfFeat = secondDict[key]
    if isinstance(valueOfFeat, dict):
        classLabel = classify(valueOfFeat, featLabels, testVec)
    else:
        classLabel = valueOfFeat
    return classLabel

...
print tree.classify({'No Surfacing?': {0: 'no', 1: {'Flippers?': {0: 'no', 1: 'yes'}}}}, ['No Surfacing?', 'Flippers?'], [1,0])

no

```

# 决策树的存储
为了避免每次分类都要重新构建决策树，可以使用``pickle``来序列化或反序列化决策树：

```python
def storeTree(inputTree, filename):
    import pickle
    fw = open(filename, 'w')
    pickle.dump(inputTree, fw)
    fw.close()


def grabTree(filename):
    import pickle
    fr = open(filename)
    return pickle.load(fr)
```


# 小结
本文介绍了``ID3``算法构建决策树的过程，但该算法并不完美：

* 可能会产生过度匹配
* 无法直接处理数值型数据，需要经过转化

后续会继续学习其他决策树的构造方法，如``C4.5``和``CART``

[Github](https://github.com/ParadeTo/ml-in-action)