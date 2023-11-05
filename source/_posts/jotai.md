---
title: 浅析状态管理库 Jotai 的实现原理
date: 2023-10-30 20:03:49
tags:
  - jotai
categories:
  - javascript
---

前段时间无意中发现了一个叫 Jotai 的状态管理库，使用起来感觉挺轻量顺手的，比如下面这个简单的例子：

```js
import {atom, useAtom} from 'jotai'

const countAtom = atom(0)

const Counter = () => {
  const [_, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount((prev) => prev + 1)}>Click Me</button>
}

const Text = () => {
  const [count] = useAtom(countAtom)
  return <div>Times: {count}</div>
}

const App = () => (
  <div>
    <Counter />
    <Text />
  </div>
)

export default App
```

例子中先是通过 `atom` 定义了一个“原子”，然后通过这个“原子”就可以实现跨组件的通信。

可以看到，上述代码中并没有用到 `Context`，那究竟是怎么实现的呢？今天就来简单的剖析一下。

熟悉 React 的同学都知道，实现组件间通信不外乎这些方式：

1. props 传递
2. Context
3. Event Bus

很明显这里用到的应该是 Event Bus，没错，那我们就用 Event Bus 来实现一下吧。

首先，我们来实现 `atom` 函数：

```js
export const atom = (value) => {
  const _atom = {
    value,
    read() {
      return this.value
    },
    write(val) {
      this.value = val
    },
  }

  return _atom
}
```

这个函数很简单，我们把传入的值包装成一个对象再返回，这样才能区别于初始值相同的两个“原子”：

```js
const atom1 = atom(0)
const atom2 = atom(0)
```

接下来是 `useAtom`：

```js
export const useAtom = (atom) => {
  return [useAtomValue(atom), useSetAtom(atom)]
}
```

我们先来看 `useSetAtom(atom)`，这个执行完返回的应该是一个函数，调用这个函数需要修改原子的值，并需要通过 Event Bus 来通知用到原子的地方进行更新：

```js
const useSetAtom = (atom) => {
  return (args) => {
    // 修改原子的值，并需要通过 Event Bus 来通知用到原子的地方进行更新
    store.setAtomValue(atom, args)
  }
}
```

简单起见，我们用一个叫 store 的对象来实现这块逻辑：

```js
const store = {
  atomListenersMap: new WeakMap(),

  setAtomValue(atom, args) {
    let value = args
    if (typeof args === 'function') {
      value = args(store.getAtomValue(atom))
    }
    atom.write(value)
    const listeners = this.atomListenersMap.get(atom)
    if (listeners) listeners.forEach((l) => l())
  },
}
```

接着我们来实现 `useAtomValue(atom)`，函数执行完后返回的应该是 atom 的值，并且函数里面需要监听原子值的变化并更新返回的值。

由于需要更新状态，所以这里肯定要用到 `useState` 或者 `useRecuder`，又因为需要监听逻辑，所以也少不了 `useEffect`，代码大概应该长这样：

```js
const useAtomValue = (atom) => {
  const [value, dispatch] = useReducer(
    ...
  )

  useEffect(() => {
   ...
  }, [])

  return value
}
```

其中，`useReducer` 实现比较简单，每次取 atom 的值返回即可：

```js
const [value, rerender] = useReducer(
  () => {
    return store.getAtomValue(atom)
  },
  undefined,
  () => store.getAtomValue(atom) // 初始值
)
```

这里取值逻辑也放到了 store 里面：

```js
const store = {
  ...
  getAtomValue(atom) {
    return atom.read()
  },
  ...
}
```

而 `useEffect` 里面则是监听逻辑，每当原子值变化时，就调用 `dispatch` 更新状态：

```js
useEffect(() => {
  const unsub = store.sub(atom, () => {
    dispatch()
  })
  return unsub
}, [])
```

`sub` 函数则是标准的 Event Bus 中的消息订阅实现方式：

```js
sub(atom, listener) {
  let listeners = this.atomListenersMap.get(atom)
  if (!listeners) {
    listeners = new Set()
    this.atomListenersMap.set(atom, listeners)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
},
```

这样，一个简单的 jotai 就完成了。接下来我们提高难度，再加点功能，比如实现这样的 derived atoms：

```js
const countAtom = atom(0)
const multipleAtom = atom((get) => get(countAtom) * 100)
const prefixAtom = atom('')
const textAtom = atom((get) => get(prefixAtom) + get(multipleAtom))
```

分析上面的代码，各原子之间其实形成了如下的依赖关系图：

```bash
textAtom ----> multipleAtom ----> countAtom
    |
    |---------------------------> prefixAtom
```

所以我们的关键就是，在 `multipleAtom` 和 `textAtom` 这类 derived atoms 首次读取值时去收集他们的依赖。而在 `countAtom` 和 `prefixAtom` 这类原始 atom 的值更新时，不仅要通知他们自己的订阅者还要通知依赖他们的 derived atoms 的订阅者去更新状态。思路清楚了，代码实现起来就简单了：

首先，我们需要修改一下 atom 的实现：

```js
export const atom = (value) => {
  const _atom = {
    write(val) {
      this.value = val
    },
  }

  if (typeof value === 'function') {
    _atom.read = value
  } else {
    _atom.value = value
    _atom.read = function (getter) {
      return getter(this)
    }
  }

  return _atom
}
```

当 `value` 是函数时，我们直接将其赋值给 `read`，同时为了保证一致，我们把默认的 `read` 定义也改成类似的方式。接下来，其他的代码都不需要改，只需要改动 store。

首先，需要在 `getAtomValue` 中收集依赖：

```js
getAtomValue(atom) {
  const getter = (a) => {
    if (a !== atom) {
      // atom 为 derived atom
      // atom 依赖 a
      // 把 atom 添加到 a 的依赖集合中
      let dependencies = this.atomDependencies.get(a)
      if (!dependencies) {
        dependencies = new Set()
        this.atomDependencies.set(a, dependencies)
      }
      if (!dependencies.has(atom)) dependencies.add(atom)
      return this.getAtomValue(a)
    } else {
      // atom 为原始 atom
      return a.value
    }
  }
  return atom.read(getter)
},
```

注意这里会递归的调用 `getAtomValue` 方法，因为 derived atom 的依赖也可能是 derived atom，比如上面的例子：

```bash
textAtom ----> multipleAtom ----> countAtom
    |
    |---------------------------> prefixAtom
```

经过依赖收集后，`atomDependencies` 的数据结构会如下所示：

```js
{
  countAtom: (multipleAtom),
  multipleAtom: (textAtom),
  prefixAtom: (textAtom)
}

```

然后是 `setAtomValue`，这里增加了一个 `notify` 的方法，也是为了递归的通知依赖进行更新：

```js
setAtomValue(atom, args) {
  let value = args
  if (typeof args === 'function') {
    value = args(this.getAtomValue(atom))
  }
  atom.write(value)
  this.notify(atom)
},
notify(atom) {
  const listeners = this.atomListenersMap.get(atom)
  if (listeners) listeners.forEach((l) => l())
  const dependencies = this.atomDependencies.get(atom)
  if (dependencies) {
    dependencies.forEach((dependency) => {
      // 还需要通知依赖自己的其他原子
      this.notify(dependency)
    })
  }
},
```

这样，derived atoms 也实现了，这个库还有很多其他强大的功能，以后慢慢再摸索吧。

附完整代码：

```js
// myJotai.js
import {useEffect} from 'react'
import {useReducer} from 'react'

const store = {
  atomListenersMap: new WeakMap(),
  atomDependencies: new WeakMap(),
  getAtomValue(atom) {
    const getter = (a) => {
      if (a !== atom) {
        // atom 依赖 a
        // 把 atom 添加到 a 的依赖集合中
        let dependencies = this.atomDependencies.get(a)
        if (!dependencies) {
          dependencies = new Set()
          this.atomDependencies.set(a, dependencies)
        }
        if (!dependencies.has(atom)) dependencies.add(atom)
        return this.getAtomValue(a)
      } else {
        return a.value
      }
    }
    console.log(this.atomDependencies)
    return atom.read(getter)
  },
  setAtomValue(atom, args) {
    let value = args
    if (typeof args === 'function') {
      value = args(this.getAtomValue(atom))
    }
    atom.write(value)
    this.notify(atom)
  },
  notify(atom) {
    const listeners = this.atomListenersMap.get(atom)
    if (listeners) listeners.forEach((l) => l())
    const dependencies = this.atomDependencies.get(atom)
    if (dependencies) {
      dependencies.forEach((dependency) => {
        // 还需要通知依赖自己的其他原子
        this.notify(dependency)
      })
    }
  },
  sub(atom, listener) {
    let listeners = this.atomListenersMap.get(atom)
    if (!listeners) {
      listeners = new Set()
      this.atomListenersMap.set(atom, listeners)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export const atom = (value) => {
  const _atom = {
    write(val) {
      this.value = val
    },
  }

  if (typeof value === 'function') {
    _atom.read = value
  } else {
    _atom.value = value
    _atom.read = function (getter) {
      return getter(this)
    }
  }

  return _atom
}

const useAtomValue = (atom) => {
  const [value, rerender] = useReducer(
    () => {
      return store.getAtomValue(atom)
    },
    undefined,
    () => store.getAtomValue(atom)
  )

  useEffect(() => {
    const unsub = store.sub(atom, () => {
      rerender()
    })
    return unsub
  }, [])

  return value
}

const useSetAtom = (atom) => {
  return (args) => {
    store.setAtomValue(atom, args)
  }
}

export const useAtom = (atom) => {
  return [useAtomValue(atom), useSetAtom(atom)]
}

// App.js
import {atom, useAtom} from './myJotai'

const countAtom = atom(0)
const multipleAtom = atom((get) => get(countAtom) * 100)
const prefixAtom = atom('')
const textAtom = atom((get) => get(prefixAtom) + get(multipleAtom))

const Counter = () => {
  const [_, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount((prev) => prev + 1)}>Click Me</button>
}

const Input = () => {
  const [_, setPrefix] = useAtom(prefixAtom)
  return <input onChange={(e) => setPrefix(e.target.value)} />
}

const Text = () => {
  const [text] = useAtom(textAtom)
  return <div>{text}</div>
}

const App = () => {
  return (
    <div>
      <Counter />
      <Input />
      <Text />
    </div>
  )
}

export default App
```
