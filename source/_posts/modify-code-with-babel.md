---
title: 使用 babel 修改 js 代码
date: 2020-07-12 16:58:43
tags:
  - babel
categories:
  - javascript
description: 使用 babel 修改 js 代码
---

最近在开发一个脚手架的时候，需要修改项目中 js 文件中的代码。一开始想到的是使用正则表达式，但是后面发现了一个似乎更好的办法，那就是 `babel`。

我们平时使用 `babel` 大部分都是在 `webpack` 中作为 `loader` 使用，但是 `babel` 也提供了几个独立的库供我们使用，按照我们写代码的顺序，会用到下面这几个库：

1. @babel/parser：解析代码生成 ast
2. @babel/traverse：遍历 ast，并对 ast 进行增删改等操作
3. @babel/types：生成 ast 中的节点
4. @babel/generator：通过 ast 生成代码

比如我要在文件所有 `import` 语句的最前面加入一条语句 `import A from 'a'` ：

```javascript
const fs = require('fs')
const {parse} = require('@babel/parser')
const traverse = require('@babel/traverse').default
const t = require('@babel/types')
const generate = require('@babel/generator').default

const code = fs.readFileSync('test.js', {
  encoding: 'utf8',
})

const ast = parse(code, {
  sourceType: 'module',
})

let imported = false
// 对 ast 进行深度遍历
traverse(ast, {
  // 当遍历到 import 语句相关的节点会执行这个方法
  ImportDeclaration(path) {
    const prevNode = path.getPrevSibling().node
    // 判断当前这个 import 语句是不是第一个
    if ((!prevNode || prevNode.type !== 'ImportDeclaration') && !imported) {
      // 需要插入的节点
      const node = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier('A'))],
        t.stringLiteral('a')
      )
      path.insertBefore(node)
      imported = true
    }
  },
})

console.log(generate(node).code)
```

按照这个模式可以很方便的修改我们的代码，不过这里有点麻烦的是 `@babel/types` 这个库的使用，必须知道每一条 js 语句它所对应的节点创建函数以及传参方式才能构建出正确的节点。[官方文档](https://www.babeljs.cn/docs/6.26.3/babel-types) 虽然列出了所有的创建函数，但是缺少足够的例子，遇到一些比较复杂的语句还是不会写。

不过，我们可以换种思路，先把我们要添加的代码通过 `babel` 转成 ast 观察下结果，然后再反过来指导我们传参。因为 `@babel/parse` 生成的 ast 会有一些额外的信息，所以这里我们用 `@babel/template` 这个库，他生成的节点比较简单，方便我们观察。

比如我想生成一条这样的语句：

```javascript
const url = isDev ? getUrl('http') : getUrl('https')
```

我们先通过 `@babel/template` 来生成一下我们的 ast：

```javascript
const template = require('@babel/template').default
const getNode = template(`const url = isDev ? getUrl('http') : getUrl('https')`)
console.log(getNode())
```

结果显示为：

```json
{
  "type": "VariableDeclaration",
  "kind": "const",
  "declarations": [
    {
      "type": "VariableDeclarator",
      "id": [Object],
      "init": [Object],
      "loc": undefined
    }
  ],
  "loc": undefined
}
```

这是一条“变量声明”语句，对应 `@babel/types` 中的函数为：

```javascript
t.variableDeclaration(kind, declarations)
```

根据以上信息，我们知道了第一个参数：

```javascript
t.variableDeclaration('const', declarations)
```

修改打印代码为 `console.log(getNode().declarations)`，我们继续看看我们的第二个参数 ：

```json
[
  {
    "type": "VariableDeclarator",
    "id": {"type": "Identifier", "name": "url", "loc": undefined},
    "init": {
      "type": "ConditionalExpression",
      "test": [Object],
      "consequent": [Object],
      "alternate": [Object],
      "loc": undefined
    },
    "loc": undefined
  }
]
```

第二个参数是一个数组，里面只有一个元素，是 `VariableDeclarator` 类型的节点:

```javascript
t.variableDeclarator(id, init)
```

`id` 这个参数我们也得到了，他是 `Identifier` 类型的：

```javascript
t.identifier(name)
```

所以我们继续补充我们的代码：

```javascript
t.variableDeclaration('const', [
  t.variableDeclarator(t.identifier('url'), init),
])
```

接下来就是一个“条件表达式”语句了：

```javascript
t.conditionalExpression(test, consequent, alternate)
```

修改打印代码为 `console.log(getNode().declarations[0].init)`，我们看看节点信息：

```json
{
  "type": "ConditionalExpression",
  "test": {"type": "Identifier", "name": "isDev", "loc": undefined},
  "consequent": {
    "type": "CallExpression",
    "callee": {"type": "Identifier", "name": "getUrl", "loc": undefined},
    "arguments": [[Object]],
    "loc": undefined
  },
  "alternate": {
    "type": "CallExpression",
    "callee": {"type": "Identifier", "name": "getUrl", "loc": undefined},
    "arguments": [[Object]],
    "loc": undefined
  },
  "loc": undefined
}
```

通过以上信息，补充我们的代码：

```javascript
t.variableDeclaration('const', [
  t.variableDeclarator(
    t.identifier('url'),
    t.conditionalExpression(t.identifier('isDev'), consequent, alternate)
  ),
])
```

还剩下两条“函数调用”语句：

```javascript
t.callExpression(callee, arguments)
```

接下来的步骤类似，这里就不再赘述了，最后的代码是：

```javascript
t.variableDeclaration('const', [
  t.variableDeclarator(
    t.identifier('url'),
    t.conditionalExpression(
      t.identifier('isDev'),
      t.callExpression(t.identifier('getUrl'), t.stringLiteral('http')),
      t.callExpression(t.identifier('getUrl'), t.stringLiteral('https'))
    )
  ),
])
```

使用 `babel` 来修改我们的代码看起来虽然比较繁琐，但是这样通过修改结构化的数据来修改代码实际上比直接操作文本字符要可靠，可以应对一些比较复杂的场景。
