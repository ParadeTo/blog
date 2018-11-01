---
title: 关于 react 事件的一个例子
date: 2018-11-01 10:49:50
tags:
- react
categories:
- javascript
description: 一个例子帮助更好的理解 react 的事件机制
---

# react 事件
react 对事件进行了合成，并将所有的事件都代理到了 document，统一分发处理。更多的内容就不说了，可以去官网查阅。
接下来直接看例子吧。

# 例子
```javascript
import React from 'react'
export default class extends React.Component {
  constructor (props) {
    super(props)
    document.addEventListener('click', function () {
      console.log(4)
    })
  }

  componentDidMount () {
    const $div = document.getElementById('div')
    $div.addEventListener('click', function () {
      console.log(2)
    })

    document.addEventListener('click', function () {
      console.log(3)
    })
  }

  onButtonClick (e) {
    // e.stopPropagation()
    // e.nativeEvent.stopPropagation()
    // e.nativeEvent.stopImmediatePropagation()
    console.log(1)
  }

  onDivClick (e) {
    console.log(5)
  }

  render () {
    return (
      <div id='div' onClick={this.onDivClick}>
        <button onClick={this.onButtonClick}>Click</button>
      </div>
    )
  }
}
```

结果打印 2 4 1 5 3, 这个结果比较奇怪，我们来分析一下：

首先，为什么 1 不是最先打印的？前面说了，`react` 其实是把事件都代理到了 `document`，所以即使这里的事件绑定在 `button`, 他也会在 2 之后打印。那为什么 4 又在 1 之前呢？这是因为 4 是在组件构造函数里面绑定的，要比 react 的事件绑定要早，而 3 是在组件挂载以后绑定，所以会在 1 之后。至于 1 和 5 的顺序，则是 react 内部帮我们维护的了，猜想 react 会根据父子关系来按顺序分发事件。

将 `e.stopPropagation()` 注释去掉后，打印 2 4 1 3，这里 e 是 react 合成以后的，调用的 `stopPropagation` 也不是浏览器原生提供的接口，所以它只能在 react 自己维护的事件中生效，所以这里只有 5 不会打印。

将 `e.nativeEvent.stopPropagation()` 注释去掉以后，打印 2 4 1 5 3，这里调用的是浏览器原生的接口，又因为 react 的事件都绑定在 document 上，所以这里 `stopPropagation()` 就没有用了。

将 `e.nativeEvent.stopImmediatePropagation()` 注释去掉以后，打印 2 4 1 5，`stopImmediatePropagation` 可以阻止掉绑定在当前元素的其他事件，不过这里有个顺序，只有先绑定的能取消掉后绑定的。例如：

```javascript
document.addEventListener('click', function (e) {
  console.log(1)
})

document.addEventListener('click', function (e) {
  e.stopImmediatePropagation()
  console.log(2)
})

document.addEventListener('click', function (e) {
  console.log(3)
})
```

会打印 1 2。


# 总结
毛主席说的好：“实践是检验真理的唯一标准！”


