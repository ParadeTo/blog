---
title: 机器学习实战-k近邻算法
date: 2017-05-21 18:07:59
tags:
- 机器学习 k近邻
categories:
- 机器学习
description: 机器学习实战k近邻算法
---

# k近邻算法
## 原理
存在一个样本数据集合，也称作训练样本集，且我们知道样本中每个数据的分类信息。
当我们输入未分类的新数据后，得到新数据与每个样本数据之间的"距离"，选择前k个距离
最近的样本中类别出现次数最多者作为新数据的类别

* 优点：精度高、对异常值不敏感、无数据输入假定
* 缺点：计算复杂度高、空间复杂度高
* 适用数据范围：数值型和标称型

## 示例
假设我们有如下样本集

|电影名称|打斗镜头|接吻镜头|电影类型|
|-------|-------|-------|------|
|California Man|3|104|爱情片|
|He's Not Really into Dudes|2|100|爱情片|
|Beautiful Woman|1|81|爱情片|
|Kevin Longblade|101|10|动作片|
|Robo Slayer 3000|99|5|动作片|
|Amped 2|98|2|动作片|
|？|18|90|未知|

即便我们不知道未知电影的类型，我们也可以计算出来。首先得到未知电影与已知数据之间的距离：

|电影名称|与未知电影的距离|
|-------|-------|
|California Man|20.5|
|He's Not Really into Dudes|18.7|
|Beautiful Woman|19.2|
|Kevin Longblade|115.3|
|Robo Slayer 3000|117.4|
|Amped 2|118.9|

现在可以找到k个距离最近的电影，取k=3，则可发现这三个电影均为爱情片，所以可以判断该电影为爱情片。

## knn算法的步骤
1. 计算已知类别数据集中的点与当前点之间的距离；
2. 按照距离递增次序排序；
3. 选取与当前点距离最小的k个点；
4. 确定前k个点所在类别的出现频率；
5. 返回前k个点出现频率最高的类别作为当前点的预测分类。

## 代码实现
```
from numpy import tile, operator

def classify0(inX, dataSet, labels, k):
    """
    knn分类函数
    :param inX: 待分类的向量
    :param dataSet: 样本数据集
    :param labels: 样本数据对应的分类向量
    :param k: 最近邻数目
    :return: 类别标签
    """
    # 得到数据大小
    dataSetSize = dataSet.shape[0]

    # 欧氏距离
    diffMat = tile(inX, (dataSetSize, 1)) - dataSet
    sqDiffMat = diffMat**2
    sqDistances = sqDiffMat.sum(axis=1)
    distances = sqDistances**0.5

    # [-1 -1 -7] => [2 0 1]
    sortedDistIndicies = distances.argsort()
    classCount={}
    for i in range(k):
        voteIlabel = labels[sortedDistIndicies[i]]
        """
            {
                "label1": 34,
                 "label2": 23,
                 "label3": 35
            }
        """
        classCount[voteIlabel] = classCount.get(voteIlabel,0) + 1

    """
        [('label3', 35), ('label1', 34), ('label2', 23)]
    """
    sortedClassCount = sorted(classCount.iteritems(), key=operator.itemgetter(1), reverse=True)
    return sortedClassCount[0][0]
    pass
```

# 示例：使用k近邻算法改进约会网站的配对效果

## 数据

|每年飞行常客里程数|玩视频游戏所耗时间百分比|每周消费冰激凌公升数|类型
|-------|-------|-------|------|
|40920|	8.32697|0.953952|largeDoses|
|14488|7.153469|1.673904|smallDoses|
|...|...|...|...|

## 解析数据
```
def file2matrix(filename):
    fr = open(filename)
    numberOfLines = len(fr.readlines())         #get the number of lines in the file
    returnMat = zeros((numberOfLines,3))        #prepare matrix to return
    classLabelVector = []                       #prepare labels return
    fr = open(filename)
    index = 0
    for line in fr.readlines():
        line = line.strip()
        listFromLine = line.split('\t')
        returnMat[index,:] = listFromLine[0:3]
        classLabelVector.append(int(listFromLine[-1]))
        index += 1
    return returnMat,classLabelVector
```

## 分析数据：绘图
### 安装matplotlib
```
pip install matplotlibrc

vi ~/.matplotlib/matplotlibrc

backend: TkAgg

```

### 绘图
```
plt.figure()
l = plt.scatter(datingDataMat[:,1], datingDataMat[:,2], 6*array(datingLabels), (datingLabels), label='1')
plt.axis([-2,25,-0.2,2.0])
plt.xlabel('Percentage of Time Spent Playing Video Games')
plt.ylabel('Liters of Ice Cream Consumed Per Week')
plt.show()
```


![1.jpg](knn/Figure_1.png)

## 数据归一化
数据中不同的属性之间量程相差很大，需要对数据进行归一化处理，常用的
归一化公式为：

```
newValue = (oldValue-min)/(max-min)
```

实现代码：

```
def autoNorm(dataSet):
    """
    [
        [ 1  1 -2]
        [-2 -2 -5]
    ]
    
    [-2 -2 -5]
    [ 1  1 -2]
    """
    minVals = dataSet.min(0)
    maxVals = dataSet.max(0)
    ranges = maxVals - minVals
    normDataSet = zeros(shape(dataSet))
    m = dataSet.shape[0]
    normDataSet = dataSet - tile(minVals, (m,1))
    normDataSet = normDataSet / tile(ranges, (m,1))   #element wise divide
    return normDataSet, ranges, minVals
```

## 测试算法
