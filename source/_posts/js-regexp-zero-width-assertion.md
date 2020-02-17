---
title: 正则表达式实现价格隐藏功能
date: 2020-02-17 16:56:24
tags:
- javascript
- 正则表达式
categories:
- javascript
description: 使用正则表达式的零宽断言实现价格隐藏功能
---

# 需求
在做优惠活动的时候，为了让优惠价格对顾客有种神秘感，勾起用户的好奇心，我们需要对优惠价做一个隐藏功能，具体规则举例来说就像这样：

| 原始价格 | 隐藏后 |
| :-: | :-: |
|1|1|
|12|12|
|123|123|
|1.000|?.000|
|12.000|?2.000|
|123.456.000|1??.??6.000|

# 知识准备
针对该需求，很快想到使用 `replace` 和 `正则表达式` 应该可以解决该问题。所以接下来先复习下这两个知识点：
## replace
`replace` 的详细介绍见[文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace)，下面举几个例子：
```javascript
'dd1a3a'.replace(/\d/, matchedStr => console.log(matchedStr)) // 只匹配到第一个就结束，打印1
'dd1a3a'.replace(/\d/g, matchedStr => {
  console.log('execute')
  console.log(matchedStr)
}) // 加上了 g 参数，表示匹配完所有的字符，执行了两次回调函数 打印 execute 两次，打印 1 3
console.log('dd1a3a'.replace(/\d/, () => '!')) // 把1替换为!，打印 dd!a3a
console.log('dd1a3a'.replace(/\d/g, () => '!')) // 把1和3替换为!，打印 dd!a!a
```
弄清楚了上面的例子就够用了，剩下的用法自行琢磨即可。
## 零宽断言
解释起来比较费口舌，还不如直接上例子：
```javascript
// 零宽度正预测先行断言，匹配 a 且 a 的后面是 b
console.log('ab'.replace(/a(?=b)/, "!")) // !b。只匹配到 a，然后把 a 替换成 !。 b 不会作为匹配结果输出，只是一个占位，这就是“零宽”的意义
console.log('ab'.replace(/a(b)/, "!")) // !。匹配到 ab，然后把 ab 替换成 !。

// 零宽度正回顾后发断言，匹配 a 且 a 的前面是 b
console.log('ba'.replace(/(?<=b)a/, "!")) // b!

// 零宽度负预测先行断言，匹配 a 且 a 的后面不是 b
console.log('abac'.replace(/a(?!b)/, "!")) // ab!c

// 零宽度负回顾后发断言，匹配 a 且 a 的前面不是 b
console.log('baca'.replace(/(?<!b)a/, "!")) // bac!
```
# 实战
我们分为三部分来写我们的正则表达式。
## 1.000 => ?.000
这种情况对应的正则表达式如下：
```
/^\d{1}(?=\.000$)/
 |  |      |
 | 匹配一   |
 | 个数字   |
 |         |
是开头      |
           |
        后面以 \.000 结尾
```
## 12.000 => ?2.000
跟第一种情况类似：
```
/^\d{1}(?=\d{1}\.000$)/
 |  |      |
 | 匹配一   |
 | 个数字   |
 |         |
是开头      |
           |
        后面以 \d{1}\.000 结尾
```
## 123.456.000 => 1??.??6.000
前面两种情况比较简单，第三种情况就比较复杂了，我们来分析下我们的目标：
```
replace(RegExp, matchedStr => { 把 23.45 变成 ??.?? 返回 })
                   |
                匹配到 23.45
```
所以第一步我们要写出能匹配到 23.45 的正则表达式：
```
/(?<=^\d{1}).+(?=\d{1}\.000$)/
 |          |      |
 |        匹配一    |
 |        个以上    |
 |        的数字    |
 |                 |
它的前              |
面有一              |
个数字              |
是开头              |
        后面以 \d{1}\.000 结尾
```
得到 `matchedStr` 以后怎么转换为我们需要的字符串呢？再用一次 `replace` 就好了！
```javascript
'123.456.000'.replace(
  /(?<=^\d{1}).+(?=\d{1}\.000$)/,
  matchedStr => matchedStr.replace(/\d/g, '?')
)
```

综合以上三种情况，我们最后的函数就是这样了：
```javascript
function hidePrice(priceStr) {
  return priceStr.replace(
    /(?<=^\d{1}).+(?=\d{1}\.000$)|^\d{1}(?=\d{1}\.000$)|^\d{1}(?=\.000$)/,
    matchedStr => matchedStr.replace(/\d/g, '?')
  )
}
```

实际生产中遇到了 safari 不支持 ?<= 的问题，所以最后改写成这样了：

```javascript
function hidePrice(priceStr) {
  return priceStr.replace(
    /^\d{1}(.+)(?=\d{1}\.\d+$)|^\d{1}(?=\.\d+$)|^\d{1}(?=\d{1}\.\d+$)/,
    (matchedStr, $1) => {
      // match the first RegExp
      if ($1) return matchedStr.substr(0, 1) + $1.replace(/\d/g, '?')
      return matchedStr.replace(/\d/g, '?')
    }
  )
}
```
