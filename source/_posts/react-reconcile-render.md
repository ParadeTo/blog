---
title: React 源码解析之协调过程（一）
date: 2021-02-08 11:34:25
tags:
  - react
categories:
  - javascript
description: 介绍 React 协调过程中的 render 阶段
---

# 引言
在[React 源码解读之首次渲染流程](/2020/07/26/react-first-render/)中我们讲到了 React 在首次渲染过程（其实更新过程也一样）中存在 `Render` 和 `Commit` 两大阶段，其中 `Render` 阶段又可称为协调阶段，它包括 `beginWork` 和 `completeWork`，本文着重讲讲 `beginWork`。

# beginWork
将 `beginWork` 进行简化后，我们发现该函数可以分为两大部分，以 `workInProgress.lanes = NoLanes;` 为分界线，前面部分是关于复用 `Fiber` 节点的逻辑，后面部分是关于更新当前 `Fiber` 节点的逻辑。所以，这里的第一个问题是，什么时候会复用 `Fiber` 节点，即 `bailoutOnAlreadyFinishedWork` 执行的前提。

```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const updateLanes = workInProgress.lanes;

  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (
      oldProps !== newProps ||
      hasLegacyContextChanged() ||
      // Force a re-render if the implementation changed due to hot reload:
      (__DEV__ ? workInProgress.type !== current.type : false)
    ) {
      // If props or context changed, mark the fiber as having performed work.
      // This may be unset if the props are determined to be equal later (memo).
      didReceiveUpdate = true;
    } else if (!includesSomeLane(renderLanes, updateLanes)) {
      didReceiveUpdate = false;
      // This fiber does not have any pending work. Bailout without entering
      // the begin phase. There's still some bookkeeping we that needs to be done
      // in this optimized path, mostly pushing stuff onto the stack.
      switch (workInProgress.tag) {
        case HostRoot:
          ...
        case HostComponent:
          ...
        case ClassComponent:
          ...
        case HostPortal:
          ...
      }
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    } else {
      if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
        // This is a special case that only exists for legacy mode.
        // See https://github.com/facebook/react/pull/19216.
        didReceiveUpdate = true;
      } else {
        // An update was scheduled on this fiber, but there are no new props
        // nor legacy context. Set this to false. If an update queue or context
        // consumer produces a changed value, it will set this to true. Otherwise,
        // the component will assume the children have not changed and bail out.
        didReceiveUpdate = false;
      }
    }
  } else {
    didReceiveUpdate = false;
  }

  // Before entering the begin phase, clear pending update priority.
  // TODO: This assumes that we're about to evaluate the component and process
  // the update queue. However, there's an exception: SimpleMemoComponent
  // sometimes bails out later in the begin phase. This indicates that we should
  // move this assignment out of the common path and into each branch.
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      ...
    case LazyComponent: {
      ...
    case FunctionComponent: {
      ...
    case ClassComponent: {
      ...
    case HostRoot:
      ...
  }
}
```

## bailout 条件
从代码中我们可以知道 `bailout` 的前提是：

1. `oldProps === newProps`
2. `hasLegacyContextChanged()` 为 `false`
3. `includesSomeLane(renderLanes, updateLanes)` 为 `false`

注意，因为我们只考虑生产环境，所以这里忽略 ` (__DEV__ ? workInProgress.type !== current.type : false)`，下面来分别分析一下这三种情况：


### `oldProps === newProps`
我们通过一个例子来分析一下，下面例子中当 `App` 触发更新时 `Son` 对应的 `Fiber` 节点能复用吗？

```javascript
import React from 'react'

function Son() {
  console.log('son render')
  return <div>Son</div>;
}


export default class App extends React.Component {
  state = {
    name: 'a'
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({
        name: 'b'
      })
    }, 1000)
  }

  render() {
    return <Son />
  }
}
```

答案是不能。因为 `return <Son />` 实际是上为转换为 `return React.createElement(Son)` 两次 `render` 函数返回的对象完全不同，故这里 `oldProps !== newProps`。若想复用的话，可以这样写：


```javascript
import React from 'react'

function Son() {
  console.log('son render')
  return <div>Son</div>;
}

const memoizedSon = <Son />

export default class App extends React.Component {
  state = {
    name: 'a'
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({
        name: 'b'
      })
    }, 1000)
  }

  render() {
    return memoizedSon
  }
}
```


