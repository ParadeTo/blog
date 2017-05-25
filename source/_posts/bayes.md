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
    返回一个向量，表示文档中的词汇是否出现在词汇表中，其实这里并没有反映字频信息，比如bitch出现了多次的文章，肯定比出现一次的文章要更加偏向于不和谐的文章，后面会有阐述
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
由上面的贝叶斯原理，得到代码如下：

```python
def trainNB0(trainMatrix,trainCategory):
    """
    :param trainMatrix:
    [
        [1,0,...],
        [0,1,...]
    ]
    :param trainCategory:
    [1,0,...]
    :return:
    """
    numTrainDocs = len(trainMatrix)
    numWords = len(trainMatrix[0])
    # 不和谐文档的概率
    pAbusive = sum(trainCategory)/float(numTrainDocs)
    # 每个词出现的次数初始化为1，防止后面计算p(x1|c)p(x2|c)...p(xn|c)的时候为0
    p0Num = ones(numWords); p1Num = ones(numWords)
    p0Denom = 2.0; p1Denom = 2.0
    for i in range(numTrainDocs):
        if trainCategory[i] == 1:
            # 向量和，统计类比1下每个词的总数
            p1Num += trainMatrix[i]
            # 得到类别1下的总次数
            p1Denom += sum(trainMatrix[i])
        else:
            p0Num += trainMatrix[i]
            p0Denom += sum(trainMatrix[i])
    # 避免p(x1|c)p(x2|c)...p(xn|c)得到很小的数最后四舍五入为0
    p1Vect = log(p1Num/p1Denom)
    p0Vect = log(p0Num/p0Denom)
    # 返回p(w|0) p(w|1) p(1) 这里w是向量
    return p0Vect,p1Vect,pAbusive
```

有两处特殊处理：
1. 将每个词的出现次数初始化为，这是为了防止计算``p(x1|c)p(x2|c)...p(xn|c)``的时候为0
2. 求条件概率的时候转为了对数，这是为了防止``p(x1|c)p(x2|c)...p(xn|c)``得到很小的数最后四舍五入为0

最后得到分类函数，很简单：

```python
def classifyNB(vec2Classify, p0Vec, p1Vec, pClass1):
    # vec2Classify * p1Vec
    # [1,0,...] * [-3.1122,-2.122,...]
    # 为什么是求和，因为已经转为了对数
    # log(p(w|c)p(c)) = log(p(w|c)) + log(p(c))
    p1 = sum(vec2Classify * p1Vec) + log(pClass1)
    p0 = sum(vec2Classify * p0Vec) + log(1.0 - pClass1)
    if p1 > p0:
        return 1
    else: 
        return 0
```

测试：

```python
...
testEntry = ['love', 'my', 'dalmation']
thisDoc = array(setOfWords2Vec(myVocabList, testEntry))
print testEntry,'classified as: ',classifyNB(thisDoc,p0V,p1V,pAb)
testEntry = ['stupid', 'garbage']
thisDoc = array(setOfWords2Vec(myVocabList, testEntry))
print testEntry,'classified as: ',classifyNB(thisDoc,p0V,p1V,pAb)
...
['love', 'my', 'dalmation'] classified as:  0
['stupid', 'garbage'] classified as:  1
```

## 文档词袋模型
上面将每个词的出现与否作为一个特征，称为词集模型。如果将词的出现频率作为特征，则称为词袋模型。
下面是词袋模型：

```python
def bagOfWords2VecMN(vocabList, inputSet):
    returnVec = [0]*len(vocabList)
    for word in inputSet:
        if word in vocabList:
            returnVec[vocabList.index(word)] += 1
    return returnVec
```

# 示例：使用朴素贝叶斯过滤垃圾邮件
## 数据
```
└─email
   ├─ham # 正常邮件
   │      1.txt
   │      10.tx
   │      11.tx
   │      12.tx
   │      13.tx
   │      14.tx
   │      15.tx
   │      16.tx
   │      17.tx
   │      18.tx
   │      19.tx
   │      2.txt
   │      20.tx
   │      21.tx
   │      22.tx
   │      23.tx
   │      24.tx
   │      25.tx
   │      3.txt
   │      4.txt
   │      5.txt
   │      6.txt
   │      7.txt
   │      8.txt
   │      9.txt
   │
   └─spam # 垃圾邮件
           1.txt
           10.tx
           11.tx
           12.tx
           13.tx
           14.tx
           15.tx
           16.tx
           17.tx
           18.tx
           19.tx
           2.txt
           20.tx
           21.tx
           22.tx
           23.tx
           24.tx
           25.tx
           3.txt
           4.txt
           5.txt
           6.txt
           7.txt
           8.txt
           9.txt
```


## 分类器构建及测试

```python
def spamTest():
    docList=[]; classList = []; fullText =[]
    for i in range(1,26):
        # 垃圾邮件
        wordList = textParse(open('email/spam/%d.txt' % i).read())
        docList.append(wordList)
        fullText.extend(wordList)
        classList.append(1)
        # 正常邮件
        wordList = textParse(open('email/ham/%d.txt' % i).read())
        docList.append(wordList)
        fullText.extend(wordList)
        classList.append(0)
    # 词典
    vocabList = createVocabList(docList)
    trainingSet = range(50); testSet=[]
    # 随机抽出测试文章索引号
    for i in range(10):
        randIndex = int(random.uniform(0,len(trainingSet)))
        testSet.append(trainingSet[randIndex])
        del(trainingSet[randIndex])
    # 得到词的条件概率
    trainMat=[]; trainClasses = []
    for docIndex in trainingSet:
        trainMat.append(bagOfWords2VecMN(vocabList, docList[docIndex]))
        trainClasses.append(classList[docIndex])
    p0V,p1V,pSpam = trainNB0(array(trainMat),array(trainClasses))
    errorCount = 0
    # 测试
    for docIndex in testSet:
        wordVector = bagOfWords2VecMN(vocabList, docList[docIndex])
        if classifyNB(array(wordVector),p0V,p1V,pSpam) != classList[docIndex]:
            errorCount += 1
            print "classification error",docList[docIndex]
            print "true class is:", 'spam' if classList[docIndex] == 1 else 'ham'
    print 'the error rate is: ',float(errorCount)/len(testSet)
```

运行，得到如下结果：
```python
classification error ['home', 'based', 'business', 'opportunity', 'knocking', 'your', 'door', 'don', 'rude', 'and', 'let', 'this', 'chance', 'you', 'can', 'earn', 'great', 'income', 'and', 'find', 'your', 'financial', 'life', 'transformed', 'learn', 'more', 'here', 'your', 'success', 'work', 'from', 'home', 'finder', 'experts']
true class is: spam
the error rate is:  0.1
```

将垃圾邮件误分为正常邮件，这种错误比将正常邮件分为垃圾邮件要可以接受。后面将会介绍如何修正分类器。


# 小结
贝叶斯分类基于独立性假设来构建，尽管并不正确，但是其仍然是一种有效的分类器。

实际使用时需要处理溢出等问题，可以通过取对数来解决。

词袋模型在解决文档分类问题上比词集模型有所提高。

可以通过移除停用词来进一步优化。






