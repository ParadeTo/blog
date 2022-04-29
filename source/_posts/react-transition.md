---
title: React 之 transition
date: 2022-04-27 18:35:18
tags:
  - react
categories:
  - javascript
description: 介绍 React 中 Suspense 提出的背景、使用方式、实现原理
---

# 引言

React 系列继续，今天来聊一聊 `transition`。话不多说，我们先用一个例子来引入今天的主题：

```js
import {useState} from 'react'

const HeavyItem = ({query}) => {
  for (let i = 0; i < 99999; i++) {}
  return <div>{query}</div>
}

export default function App() {
  const [inputValue, setInputValue] = useState('')
  const handleChange = (e) => {
    setInputValue(e.target.value)
  }
  return (
    <div style={{paddingLeft: 100, paddingTop: 10}}>
      <input value={inputValue} onChange={handleChange} />
      <div>
        {[...new Array(5000)].map(() => (
          <HeavyItem query={inputValue} />
        ))}
      </div>
    </div>
  )
}
```

上面例子模拟了一个关键词搜索的应用，注意到其中的每一项搜索结果 `HeavyItem` 其渲染任务是一个非常耗时的操作。所以，我们在搜索的时候会感觉到有明显的卡顿现象：
![](./react-transition/search.gif)

根本原因在于搜索列表的渲染是一个非常耗时的操作，整个 React 应用的更新都被其所阻塞。但其实列表的更新可以稍后一些，而搜索关键字在 `input` 中的更新必须足够及时才能使得用户使用应用感觉流畅，也就是两个更新的优先级是有先后的，`transition` 的出现，就是为了解决这一类的问题。

# useTransition 的使用

我们通过 React 提供的 `useTransiton` 来优化上面的例子：

```js
import {useState, useTransition} from 'react'

const HeavyItem = ({query}) => {
  for (let i = 0; i < 99999; i++) {}
  return <div>{query}</div>
}

export default function App() {
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const handleChange = (e) => {
    setInputValue(e.target.value)
    startTransition(() => {
      setQuery(e.target.value)
    })
  }
  return (
    <div style={{paddingLeft: 100, paddingTop: 10}}>
      <input value={inputValue} onChange={handleChange} />
      <div>
        {isPending
          ? 'Loading'
          : [...new Array(5000)].map(() => <HeavyItem query={query} />)}
      </div>
    </div>
  )
}
```

可以看到，现在搜索体验非常丝滑了：

![](./react-transition/search-transition.gif)

先简单解释一下上面的代码，`useTransition` 返回
