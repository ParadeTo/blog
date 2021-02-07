---
title: 编译原理之 PEG.js
date: 2021-02-07 17:30:12
tags:
- pegjs
categories:
- 编译原理
description: 介绍 PEG.js 的使用方式
---

# 引言
在[编译原理之手写一门解释型语言](/2020/02/27/compile-simple-language/)中我们全手动写了一个 `Parser` 来解析我们的脚本，实际上有现成的工具可以更加方便的完成这个工作，比如 PEG.js。该工具通过解析语法规则来自动生成 `Parser`，开发人员只需要专注于编写语法规则即可。

# 语法规则基本写法
安装及基础 API 使用详见[官网](https://nathanpointer.com/)，本文通过几个例子介绍一下语法规则的编写方法：

```
word = [a-zA-Z]*
```

上面定义了一个名叫 `word` 的规则，其中 `[a-zA-Z]*` 跟正则表达式一样，表示匹配 0 个及以上的英文字母。

解析 `hello`， 上面的规则会返回如下的结构：

```
[ "h", "e", "l", "l", "o"]
```

如果想得到整个单词怎么办呢？由于 PEG.js 支持在语法规则中编写 js 代码，所以我们可以这样写：

```
word = w:[a-zA-Z]* {
  return w.join("")
}
```

其中，`w` 表示所匹配到的所有字符组成的数组，即上面的 `[ "h", "e", "l", "l", "o"]`。或者，直接这样写：

```
word = [a-zA-Z]* {
  return text()
}
```

当然，规则中也可以包含其他的规则，比如：

```
statement = words:(word (blank / "."))* {
	return words.map(word => word.join("")).join("")
}

word = w:[a-zA-Z]* {
  return w.join("")
}

blank = [ ]
```

`statement` 会匹配若干个 `word blank`（单词后面加个空格） 或 `word "."`（单词后面加个 `.` ）。比如，解析 `hello world.`，`words` 的结果如下所示：

```
[
  ["hello", " "],
  ["world", "."]
]
```

了解了这些基本的写法后，接下来让我们分析下官网的在线例子：[Simple Arithmetics Grammar](https://pegjs.org/online)。

# Simple Arithmetics Grammar

```
Expression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        if (element[1] === "+") { return result + element[3]; }
        if (element[1] === "-") { return result - element[3]; }
      }, head);
    }

Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)* {
      return tail.reduce(function(result, element) {
        if (element[1] === "*") { return result * element[3]; }
        if (element[1] === "/") { return result / element[3]; }
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Integer

Integer "integer"
  = _ [0-9]+ { return parseInt(text(), 10); }

_ "whitespace"
  = [ \t\n\r]*
```

其中，规则 `_`、`Integer`、`Factor` 比较简单，这里就不啰嗦了，我们来看看 `Term` 和 `Expression`。

为了方便分析 `Term`，我们暂时修改一下他的规则：

```
Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)* {
  	  return { head, tail }
    }
```

解析 `2*3*4`，我们可以得到如下结果：

```
{
   "head": 2,
   "tail": [
      [
         [],
         "*",
         [],
         3
      ],
      [
         [],
         "*",
         [],
         4
      ]
   ]
}
```

有了上面的结果，相信你已经知道原来的这一段代码是干什么用的了吧：

```
return tail.reduce(function(result, element) {
  if (element[1] === "*") { return result * element[3]; }
  if (element[1] === "/") { return result / element[3]; }
}, head);
```

同样的，可以用类似的方法来分析 `Expression`，这里就不展开了。

# 总结
本文介绍了 PEG.js 的基本使用方法，借用该工具，我们可以做很多有意义的事情，比如我们开发的数据库管理平台就需要在前端解析 SQL 语句，用到的第三方库 `node-sql-parser` 中就使用了该工具。