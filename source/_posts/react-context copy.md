---
title: React 源码解读之 Context（一）
date: 2021-03-19 14:12:25
tags:
  - react
categories:
  - javascript
description: 介绍 React 中 Context 相关的内容
---

# 引言
React 源码系列继续进行，今天来讲讲 `Context` 相关的内容。从何讲起呢？我们还是先从一个案例开始吧：

```javascript
import React, { Component } from 'react'
import PropTypes from 'prop-types';

class Grandson extends Component {
  render() {
    console.log('Grandson render')
    return <span>{this.context.theme}</span>
  }
}

Grandson.contextTypes = {
  theme: PropTypes.string
}

class Son extends Component {
  render() {
    console.log('Son render');
    return <Grandson />
  }
}

export default class Parent extends Component {
  state = {
    theme: 'blue'
  }
  getChildContext() {
    return this.state
  }
  componentDidMount() {
    setTimeout(() => {
      this.setState({
        theme: 'red'
      })
    }, 1000)
  }
  render() {
    return <Son />;
  }
}

Parent.childContextTypes = {
  theme: PropTypes.string
}
```

上述代码使用了 React 已废弃的 Context API。`Parent` 组件提供了一个 `context`，该 `context` 只在孙组件 `Grandson` 里面用到了。既然这样，那 `context` 变化的时候子组件 `Son` 不应该调用 `render` 方法（目前是会的）。所以，我们用 `PureComponent` 来优化一下：

```javascript
class Son extends PureComponent {
  render() {
    console.log('Son render');
    return <Grandson />
  }
}
```

现在 `Son` 组件确实不会调用 `render` 方法了，然而悲剧的是 `Grandson` 也不会更新了。原因在于 `Son` 组件协调时进入了 [`bailout`](/2021/02/08/react-reconcile-bailout/) 逻辑，阻断了子组件的更新：

```javascript
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  ...
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // 协调 Son 组件的时候走到了这里
    return null;
  } else {
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }
}
```

但是如果换成新的 API 则不会有这个问题：

```javascript
import React, {Component, PureComponent} from 'react'

const Context = React.createContext()

class Grandson extends Component {
  render() {
    console.log('Grandson render')
    return (
      <Context.Consumer>
        {
          value => <span>{value}</span>
        }
      </Context.Consumer>
    )
  }
}

class Son extends PureComponent {
  render() {
    console.log('Son render')
    return <Grandson />
  }
}


export default class Parent extends Component {
  state = {
    theme: 'blue'
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({
        theme: 'red'
      })
    }, 1000)
  }

  render() {
    return (
      <Context.Provider value={this.state.theme}>
        <Son />
      </Context.Provider>
    )
  }
}
```

接下来就针对该问题来分析一下新旧 API 的源码，从而解答我们的疑惑。

# 旧 API
为了方便理解，我们用下面的代码来讲解旧的 Context API 的工作原理：
```javascript
import React from 'react'
import PropTypes from 'prop-types';

class Son extends React.Component {
  getChildContext() {
    return {language: 'en'}
  }

  render() {
    return <Grandson />
  }
}

Son.childContextTypes = {
  language: PropTypes.string
}

class Grandson extends React.Component {
  render() {
    return <span>{this.context.theme}{this.context.language}</span>
  }
}

Grandson.contextTypes = {
  theme: PropTypes.string,
  language: PropTypes.string
}


export default class Parent extends React.Component {
  state = {
    theme: 'blue'
  }

  getChildContext() {
    return this.state
  }

  render() {
    return <Son />;
  }
}

Parent.childContextTypes = {
  theme: PropTypes.string
}
```

旧的 API `Context` 的值是存在栈上的，当 React 处理到 `Parent` 这个组件时，会通过 `getChildContext` 得到 context 的值，然后 `push` 到栈顶：

```javascript
function invalidateContextProvider(
  workInProgress: Fiber,
  type: any,
  didChange: boolean,
): void {
  if (disableLegacyContext) {
    return;
  } else {
    const instance = workInProgress.stateNode;

    if (didChange) {
      // 合并父组件的 context 和自身的 context（会调用 getChildContext）
      const mergedContext = processChildContext(
        workInProgress,
        type,
        previousContext,
      );
      ...
      // 将合并后的 context push 到栈顶
      push(contextStackCursor, mergedContext, workInProgress);
      push(didPerformWorkStackCursor, didChange, workInProgress);
    } else {
      ...
    }
  }
}
```

处理完 `Parent` 组件后，此时栈顶值为 `{ theme: 'blue' }`。同理，当处理完 `Son` 组件后，此时栈顶值为 `{ theme: 'blue', language: 'en' }`。

当处理到 `Grandson` 组件时，此时因为该组件上有 `contextTypes` 这个属性，所以会去读 `Context`：

```javascript
function constructClassInstance(
  workInProgress: Fiber,
  ctor: any,
  props: any,
): any {
  ...
  if (typeof contextType === 'object' && contextType !== null) {
    ...
  } else if (!disableLegacyContext) {
    unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    const contextTypes = ctor.contextTypes;
    isLegacyContextConsumer =
      contextTypes !== null && contextTypes !== undefined;
    context = isLegacyContextConsumer
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyContextObject;
  }

  return instance;
}
```

