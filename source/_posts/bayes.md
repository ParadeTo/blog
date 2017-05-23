---
title: 机器学习实战-朴素贝叶斯算法
date: 2017-05-23 16:22:31
tags:
- 机器学习
categories:
- 机器学习
description: 机器学习实战之朴素贝叶斯算法
---
贝叶斯分类算法是统计学的一种分类方法，它是一类利用概率统计知识进行分类的算法。

* 优点：在数据较少的情况下仍然有效，可以处理多类别问题。
* 缺点：对于输入数据的准备方式较为敏感。
* 适用数据类型：标称型数据

假设有一数据集，由两类数据组成，数据有两个属性x，y。现在用``p1(x,y)``，``p2(x,y)``分别表示数据点``(x,y)``属于类别1和类别2的概率。那么可以用下面的规则来判断它的类别：

* p1(x,y) > p2(x,y)，那么类别为1
* p1(x,y) < p2(x,y)，那么类别为2

# 原理
首先，由条件概率可以，有以下推导：

```python
已知p(x|c)，求p(c|x)，c代表属性向量

p(x|c)p(c) = p(xc) = p(c|x)p(x)

=>

p(c|x) = p(x|c)p(c) / p(x)
```

在对待分类数据进行分类时，``p(x)``是相同的，故可以不考虑。现在的关键问题是如何计算``p(x|c)p(c)``，这就需要用到贝叶斯假设了，贝叶斯假设x中每个属性都是独立的，则:

```
p(x|c)p(c) = p(x1|c)p(c)p(x2|c)p(c)...p(xn|c)p(c)
```

# 使用python进行文本分类
可以使用文本中的词条作为文本的特征来进行分类，这里为了方便，暂时不处理中文

## 数据处理
```python
def loadDataSet():
    """
    测试数据，每行可看成一个文章包含的词
    返回文章列表及其分类向量
    """
    postingList=[['my', 'dog', 'has', 'flea', 'problems', 'help', 'please'],
                 ['maybe', 'not', 'take', 'him', 'to', 'dog', 'park', 'stupid'],
                 ['my', 'dalmation', 'is', 'so', 'cute', 'I', 'love', 'him'],
                 ['stop', 'posting', 'stupid', 'worthless', 'garbage'],
                 ['mr', 'licks', 'ate', 'my', 'steak', 'how', 'to', 'stop', 'him'],
                 ['quit', 'buying', 'worthless', 'dog', 'food', 'stupid']]
    classVec = [0,1,0,1,0,1]    #1 不和谐, 0 正常
    return postingList,classVec

def createVocabList(dataSet):
    """
    返回词汇列表
    ['cute', 'love', 'help', 'garbage', 'quit', 'I',...
    """
    vocabSet = set([])
    for document in dataSet:
        vocabSet = vocabSet | set(document) # 求并集
    return list(vocabSet)

def setOfWords2Vec(vocabList, inputSet):
    """
    返回一个向量，表示文档中的词汇是否出现在词汇表中
    [0, 1, 0...
    """
    returnVec = [0]*len(vocabList)
    for word in inputSet:
        if word in vocabList:
            returnVec[vocabList.index(word)] = 1
        else: print "the word: %s is not in my Vocabulary!" % word
    return returnVec
...
# 测试
import bayes

listOPosts, listClasses = bayes.loadDataSet()
vocabList = bayes.createVocabList(listOPosts)
print vocabList # ['cute', 'love', 'help', 'garbage', 'quit', 'I', 'proble...
print bayes.setOfWords2Vec(vocabList, listOPosts[0]) # [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,...

```

## 训练算法
由上面的贝叶斯原理，得到伪代码如下：

```python
对每篇训练文档（经过setOfWords2Vec处理）
```



