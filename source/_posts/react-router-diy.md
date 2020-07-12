---
title: 手写一个简单的 react-router
date: 2020-07-04 10:51:40
tags:
  - react
categories:
  - javascript
description: 通过实现一个简单的 react-router 来学习源码
---

学习源码最好的方式是模仿着自己写一个，所以今天我们来实现一个简单的 `react-router`。

# Router

我们先来实现一下 `Router`：

```javascript
class Router extends Component {
  static computeRootMatch(pathname) {
    return {path: '/', url: '/', params: {}, isExact: pathname === '/'}
  }

  constructor(props) {
    super(props)
    this.state = {
      location: props.history.location,
    }
    props.history.listen((location) => {
      this.setState({location})
    })
  }

  render() {
    const {history, children} = this.props
    return (
      <RouterContext.Provider
        value={{
          history,
          location: this.state.location,
          match: Router.computeRootMatch(this.state.location.pathname),
        }}>
        {children}
      </RouterContext.Provider>
    )
  }
}
```

`Router` 很简单，就是通过 `context` 把路由相关信息传递下去，同时监听 `history` 的变化。

```javascript
class BrowserRouter extends Component {
  constructor(props) {
    super(props)
    this.history = createBrowserHistory()
  }
  render() {
    return <Router children={this.props.children} history={this.history} />
  }
}
```

`BrowserRouter` 是建立在 `Router` 基础之上的，只是传入了一个适配浏览器平台的 `history`。

# Route

```javascript
export default class Route extends Component {
  render() {
    return (
      <RouterContext.Consumer>
        {(context) => {
          const {location} = context
          const {path, children, component, render} = this.props
          const match = path
            ? matchPath(location.pathname, this.props)
            : context.match
          const props = {
            ...context,
            location,
            match,
          }
          //match children, component, render | null
          //不match children function | null
          return (
            <RouterContext.Provider value={props}>
              {match
                ? children
                  ? typeof children === 'function'
                    ? children(props)
                    : children
                  : component
                  ? React.createElement(component, props)
                  : render
                  ? render(props)
                  : null
                : typeof children === 'function'
                ? children(props)
                : null}
            </RouterContext.Provider>
          )
        }}
      </RouterContext.Consumer>
    )
  }
}
```

`Route` 其实也挺简单的，拿到 `context` 中的当前 `location` 与 `props` 中的 `path` 进行一个匹配，然后按照 `children`, `component` 和 `render` 的顺序来渲染组件。如果没传 `path`，比如说 404 页面，则用 `context.match` 作为最终匹配的 `match`。

这里注意需要覆盖掉 `Router` 中传过来的 `match`，然后继续传给下面的组件。

# Switch

```javascript
class Switch extends Component {
  render() {
    return (
      <RouterContext.Consumer>
        {(context) => {
          const {location} = context
          let match //找到匹配的元素，match设置为true
          let element // 匹配的元素

          const {children} = this.props

          React.Children.forEach(children, (child) => {
            if (match == null && React.isValidElement(child)) {
              element = child
              const {path} = child.props
              match = path
                ? matchPath(location.pathname, child.props)
                : context.match
            }
          })

          return match
            ? React.cloneElement(element, {
                computedMatch: match,
              })
            : null
        }}
      </RouterContext.Consumer>
    )
  }
}
```

`Switch` 的作用就是找到第一个匹配的 `Route` 进行渲染，其他的则忽略。所以这里需要对 `Switch` 中的所有子组件进行一个遍历。注意到如果 `Switch` 下如果有非 `Router` 的组件，按照这里的逻辑 `match` 会是 `context.match`，所以最后会被渲染出来。

# 其他

主要的组件都写出来了，其他一些边界料的工作也比较简单了。

## Link

```javascript
class Link extends Component {
  static contextType = RouterContext
  handleClick = (e) => {
    e.preventDefault()
    // 命令式
    this.context.history.push(this.props.to)
  }
  render() {
    const {to, children, ...restProps} = this.props
    return (
      <a href={to} {...restProps} onClick={this.handleClick}>
        {children}
      </a>
    )
  }
}
```

## hooks

```javascript
export function useHistory() {
  return useContext(RouterContext).history
}

export function useLocation() {
  return useContext(RouterContext).location
}

export function useParams() {
  const match = useContext(RouterContext).match
  return match ? match.params : {}
}

export function useRouteMatch() {
  return useContext(RouterContext).match
}
```

## Prompt

```javascript
function Prompt({when = true, message}) {
  return (
    <RouterContext.Consumer>
      {(context) => {
        if (!when) return null
        // 阅读源码可知，block 中只是把 prompt 这个内部变量进行了赋值，并不会执行 window.confirm
        // 在下次路由变化的时候，confirmTransitionTo 这个方法中会将 prompt 传给 window.confirm 调用
        // block 调用后会返回一个函数，该函数执行会把 prompt 置为空
        const method = context.history.block
        return (
          <LifeCycle
            // 组件挂载后，对 prompt 进行赋值
            onMount={(self) => (self.release = method(message))}
            // 组件卸载的时候，即跳到其他路由后，把 prompt 置空，避免污染其他路由
            onUnmount={(self) => self.release()}
          />
        )
      }}
    </RouterContext.Consumer>
  )
}

class LifeCycle extends React.Component {
  componentDidMount() {
    if (this.props.onMount) {
      this.props.onMount.call(this, this)
    }
  }

  componentWillUnmount() {
    if (this.props.onUnmount) this.props.onUnmount.call(this, this)
  }

  render() {
    return null
  }
}
```
