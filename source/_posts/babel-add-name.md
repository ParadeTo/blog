---
title: 用 Babel 给 React 组件起名字
date: 2021-09-19 16:46:13
tags:
  - react
  - babel
categories:
  - javascript
description: 使用 Babel 给 React 取名字
---

# 背景

假设我们现在有这样一份代码：

```js
function MyComp() {
  return <span>My Comp</span>
}

function App(props) {
  if (props.children.type.name.startsWith('My')) return props.children
}

ReactDOM.render(
  <App>
    <MyComp />
  </App>,
  document.getElementById('root')
)
```

这个代码的大概意思是在 `App` 组件中，只渲染组件名为 `My` 开头的子组件。但是当这份代码打包发布后，发现并没有生效，为什么呢？原因是打包过程中对代码进行了混淆，`MyComp` 已经被转为了其他的字符。这时，可以通过给组件添加一个变量来实现：

```js
MyComp.displayName = 'MyComp'
```

`App` 组件中的判断逻辑也需要修改为：

```js
if (props.children.type.displayName.startsWith('My'))
```

一个组件还好，如果项目中有成千上万个组件呢？所以，就衍生出了我们今天的主题：如何用 Babel 给 React 组件起名字？答案也很简单：写一个 Babel 插件。

# Babel 插件

## 需求分析

首先，我们需要分析一下我们的 React 组件都有哪些可能的定义形式，以及他们在 Babel 中的节点类型。这里列举几个常见的：

```js
// 1
function Comp() {
  return <span>Comp</span>
}
/*
{
  type: 'FunctionDeclaration',
  id: { type: 'Identifier', name: 'Comp', loc: undefined },
}
*/


// 2
const Comp = () => {
  return <span>Comp</span>
}
/*
{
  type: 'VariableDeclaration',
  kind: 'const',
  declarations: [
    {
      type: 'VariableDeclarator',
      id: [Object],
      init: [Object],
      loc: undefined
    }
  ],
  ...
}
*/

// 3
export default () => {
  return <span>Comp</span>
}
/*
{
  type: 'ExportDefaultDeclaration',
  declaration: {
    type: 'ArrowFunctionExpression',
    ...
  },
  ...
}
*/

// 4
class Comp extends React.Component {
  render() {
    return <span>Comp</span>
  }
}
/*
{
  type: 'ClassDeclaration',
  id: { type: 'Identifier', name: 'Comp', loc: undefined },
  body: { type: 'ClassBody', body: [ [Object] ], loc: undefined },
  ...
}
*/

// 5
export default class extends React.Component {
  render() {
    return <span>Comp</span>
  }
}
/*
{
  type: 'ExportDefaultDeclaration',
  declaration: {
    type: 'ClassDeclaration',
    id: null,
    body: { type: 'ClassBody', body: [Array], loc: undefined },
    ...
  },
  ...
}
*/
```

这里还有一个问题是，如何区别普通函数/类与 React 的组件呢，答案就是看这些节点的子节点中是否含有 `JSXElement` 类型的节点。思路有了，代码就呼之欲出了。

## 插件实现

以下给出了两种情况的 `visitor`，其他的情况类似，就不赘述了。

```js
function createDisplayNameNode(elementName, property = 'displayName') {
  const node = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(elementName), t.identifier(property)),
      t.stringLiteral(elementName)
    )
  )
  return node
}

function hasJSXElement(path) {
  let hasJSXElement = false
  path.traverse({
    JSXElement(path) {
      hasJSXElement = true
    },
  })
  return hasJSXElement
}

function myCustomPlugin() {
  return {
    visitor: {
      FunctionDeclaration(path) {
        if (hasJSXElement(path)) {
          path.insertAfter(createDisplayNameNode(path.node.id.name))
        }
      },
      /**
       * 处理有多个变量声明语句的情况：
       * const C1 = () => { return <span>C1</span> }, C2 = () => { return <span>C2</span> }
       */
      VariableDeclaration(path) {
        const arr = []
        path.traverse({
          VariableDeclarator(path) {
            if (hasJSXElement(path)) {
              arr.push(path.node.id.name)
            }
          },
        })
        arr.forEach((name) => path.insertAfter(createDisplayNameNode(name)))
      },
      ...
    },
  }
}
```

值得注意的是，上面的代码都是在 enter 阶段进行处理。其实放在 exit 阶段也可以，只不过需要注意与 `@babel/plugin-transform-react-jsx` 插件的顺序问题，必须在其前面，因为 `@babel/plugin-transform-react-jsx` 会在 exit `JSXElement` 的时候对 `JSXElement` 进行替换。

# 总结

本文从实际开发场景中引申出了如何给 React 组件添加名字的主题，并分析了 React 组件常见的几种定义方式，最后通过编写 Babel 插件实现了我们的需求。
