---
title: 一种实现 virtual list 的方式
date: 2018-10-25 14:11:16
tags:
- react
categories:
- javascript
---

# Virtual List
当我们在浏览器上浏览一个很大的列表时，会渲染出很多标签，但是用户能看到的就只有可视区那些而已，真的有必要把所有的都渲染出来吗？如果不是的话，那有什么好的办法呢？这就轮到 virtual list 出马了，virtual list 的原则就是只渲染特定数量的元素，当用户上下滚动时，替换掉这些元素里面的内容。

# 实现方式
## 页面结构
```html
<div className='container'>
  <div className='holder'></div>
  <ul className='content'></ul>
</div>
...
.container {
  height: 100%;
  width: 100%;
  overflow: auto;
  position: relative;
}

.holder {
  background-color: transparent;
}

.content {
  background-color: white;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
```

这里，container 是可视区，需要设定高度。`content` 下面就是我们要渲染的列表。但是这个 `holder` 是啥玩意呢？

前面说过了我们的列表数量是特定的，可以根据列表元素和可视区的高度可以计算出来，那么我们怎么滚动起来呢？`holder` 就是用来做这个的，`holder` 的高度是列表所有元素的高度和，这样我们就用它模拟出了所有元素都渲染出来的时候的一个滚动效果。

当我们往上滚动的时候，`content` 会随着父元素一起往上滚，我们就看不到内容了，所以我们还需要实时得到往上滚动的距离，并设置 `translate3D(0, ${scrollTop}px, 0)`, 这样 `content` 就可以一直保持在可视区了，然后我们将 `content` 下的内容替换成当前应该显示的元素，这样就大功告成了。

## 代码实现
最后放上 react 版本的代码：
```jsx
import React from 'react'
import './style.scss'

export default class extends React.Component {
  constructor (props) {
    super(props)
    this.itemLen = 1000
    this.height = 30
  }

  genList () {
    const { height, itemLen } = this
    const arr = []
    for (let i = 0; i < itemLen; i++) {
      arr.push(
        <div
          key={i}
          style={{
            height: `${height}px`,
            boxSizing: 'border-box',
            borderBottom: '1px solid gray'
          }}
        >
          Item {i}
        </div>
      )
    }
    return arr
  }

  render () {
    return (
      <VirtualList
        itemHeight={this.height}
      >
        {
          this.genList()
        }
      </VirtualList>
    )
  }
}

class VirtualList extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      scrollTop: 0,
      translateY: 0,
      containerHeight: 0
    }
    this.$container = null
  }

  onScroll (dom) {
    if (dom) {
      this.$container = dom
      let timer
      dom.addEventListener('scroll', e => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          this.setState({
            scrollTop: dom.scrollTop
          })
        }, 10)
      })
    }
  }

  componentDidMount () {
    setTimeout(() => {
      this.setState({
        containerHeight: this.$container.offsetHeight
      })
    }, 10)
  }

  getVirtualList () {
    const { scrollTop, containerHeight } = this.state
    const { itemHeight, children } = this.props
    const firstIdx = Math.floor(scrollTop / itemHeight)
    const lastIdx = firstIdx + Math.ceil(containerHeight / itemHeight) + 1
    const arr = []
    for (let i = firstIdx; i <= lastIdx; i++) {
      arr.push(
        <li
          key={i - firstIdx}
        >
          {children[i]}
        </li>
      )
    }
    console.log(firstIdx, containerHeight)
    return {
      arr,
      translateY: firstIdx * itemHeight
    }
  }

  render () {
    const { itemHeight, children } = this.props
    const len = children.length
    const { arr, translateY } = this.getVirtualList()

    return (
      <div className='container' ref={ref => this.onScroll(ref)}>
        <div
          className='holder'
          style={{
            height: itemHeight * len + 'px'
          }}
        />
        <ul
          className='content'
          style={{
            transform: `translate3D(0, ${translateY}px, 0)`
          }}
        >
          {
            arr
          }
        </ul>
      </div>
    )
  }
}
```
