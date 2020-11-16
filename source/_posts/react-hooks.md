---
title: React 源码解读之 Hooks
date: 2020-11-06 16:45:07
tags:
  - react
categories:
  - javascript
description: React 源码解读的第一篇文章，介绍首次渲染的流程
---

# 题目
老规矩，在进入正题前，先来几个题目：

题目一：下面的组件能否正常工作吗？Why?

```javascript
export default function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <h1>{count}</h1>;
}
```

答案：不能，永远都渲染 1。

题目二：2s 后，日志会打印几次？注释掉 1，放开 2 后呢？

```javascript
const Child = memo(({ onClick }) => {
  console.log(`child render`)
  return <div onClick={onClick}>Child</div>
})

const Parent = ({ name }) => {
  // 1
  const onClick = () => console.log('click')

  // 2
  // const onClick = useCallback(() => console.log('click'), [])

  return (
    <div>
      <div>{name}</div>
      <Child onClick={onClick} />
    </div>

  )
}


export default function App() {
  const [name, setName] = useState('a')
  useEffect(() => {
    setTimeout(() => {
      setName('b')
    }, 2000)
  }, [])
  return <Parent name={name} />
}
```

答案：都是两次

题目三：能说出下面两段代码运行的不同之处吗？

```javascript
// 1
export default function App(props) {
  const [num, setNum] = useState(0)

  React.useEffect(() => {
    const observer = new MutationObserver(function(mutationsList, observer) {
      console.log(mutationsList)
    })
    const $num = document.querySelector('#num')
    observer.observe($num, { attributes: true, childList: true, subtree: true })

    setNum(num => num + 1)
    setNum(num => num + 1)
  }, [])

  return (
    <div id='num' className={num}>Num</div>
  )
}
```

```javascript
// 2
export default function App(props) {
  const [num, setNum] = useState(0)

  React.useEffect(() => {
    const observer = new MutationObserver(function(mutationsList, observer) {
      console.log(mutationsList)
    })
    const $num = document.querySelector('#num')
    observer.observe($num, { attributes: true, childList: true, subtree: true })

    setTimeout(() => {
      setNum(num => num + 1)
      setNum(num => num + 1)
    })
  }, [])

  return (
    <div id='num' className={num}>Num</div>
  )
}
```

答案：代码 1 打印的数组长度为 1，代码 2 打印的数组长度为 2。

你都搞清楚了吗？

# Hooks
## Hook 是什么
hook 就是一个对象，源码中定义如下：

```javascript
export type Hook = {|
  memoizedState: any,
  baseState: any,
  baseQueue: Update<any, any> | null,
  queue: UpdateQueue<any, any> | null,
  next: Hook | null,
|};
```

## Hooks 是怎么存储的
如下图所示，hooks 之间会形成一个链表并保持在 `FiberNode` 的 `memoizedState` 属性之上，链表通过游标 `currentHook` 或 `workInProgressHook` 来进行遍历。我们知道 React 更新的时候会存在两棵 Fiber 树，一颗是上次已经构建好的 Fiber 树，一颗是正在构建的 Fiber 树，而 `currentHook` 和 `workInProgressHook` 分别是为这两棵树工作的。

![](react-hooks/hooks-store.png)

首次渲染时，因为 hooks 链表还未形成，所以需要构建 hooks 链表，当调用 `useState`, `useEffect` 等函数时，最终都会调用 `mountState`, `mountEffect` 等方法。更新的时候，因为 hooks 链表已存在，需要对其进行更新，当调用 `useState`, `useEffect` 等函数时，最终都会调用 `updateState`, `updateEffect` 等方法：

```javascript
const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  useCallback: mountCallback,
  useContext: readContext,
  useEffect: mountEffect,
  useImperativeHandle: mountImperativeHandle,
  useLayoutEffect: mountLayoutEffect,
  useMemo: mountMemo,
  useReducer: mountReducer,
  useRef: mountRef,
  useState: mountState,
  useDebugValue: mountDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: mountDeferredValue,
  useTransition: mountTransition,
  useMutableSource: mountMutableSource,
  useOpaqueIdentifier: mountOpaqueIdentifier,
};

const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  useDebugValue: updateDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: updateDeferredValue,
  useTransition: updateTransition,
  useMutableSource: updateMutableSource,
  useOpaqueIdentifier: updateOpaqueIdentifier,
};
```

React 通过当前正在构建的 `workInProgress` 所指向的 `FibeNode` 是否有对应的 `current` 来判断是否为首次渲染，从而调用不同的 hooks 方法：

```javascript
ReactCurrentDispatcher.current =
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount
    : HooksDispatcherOnUpdate;
...
function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  return dispatcher;
}
...
export function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: (I) => S,
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}
```

了解了 Hooks 的一些基本信息后，接下来看看常用的一些 Hooks 到底是怎么工作的吧。

# 常见 Hooks 分析
官网中列出了如下常用的 hooks：

Basic Hooks:
* useState
* useEffect
* useContext


Additional Hooks:
* useReducer
* useCallback
* useMemo
* useRef
* useImperativeHandle
* useLayoutEffect
* useDebugValue

这里我们暂时先不讨论 useContext 和 useDebugValue。而这些 hooks 中只需要搞清楚 useReducer 和 useEffect 即可，其他几个要么比较简单，要么跟 useReducer 和 useEffect 类似。

## useReducer
我们以下面的例子来分析 useReducer 的运作流程：
```javascript
export default function App(props) {
  const [state, dispatch] = useReducer(function myReducer(state, action) {
    switch (action.type) {
      case 'increment':
        return {count: state.count + action.num};
      case 'decrement':
        return {count: state.count - action.num};
      default:
        throw new Error();
    }
  }, {count: 0})
  return (
    <div>
      {state.count}
      <button onClick={() => dispatch({type: 'decrement', num: 1})}>-</button>
      <button onClick={() => {
        dispatch({type: 'increment', num: 1})
        dispatch({type: 'increment', num: 2})
      }}>+</button>
    </div>
  )
}

```

### 首次渲染
首次渲染时，会执行 `mountReducer`:

```javascript
function mountReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: (I) => S,
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook();
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = ((initialArg: any): S);
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: (initialState: any),
  });
  const dispatch: Dispatch<A> = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  return [hook.memoizedState, dispatch];
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

```

这里调用 `mountWorkInProgressHook` 生成一个新的 hook，如果是第一个 hook，会挂载到 `FibeNode` 的 `memoizedState` 上面，否则放到 hook 链表的末尾。最后，返回这个新的 hook。

接着会更新 hook 上面的属性，并返回 `hook.memoizedState` 和 `dispatch`（该方法后续再讨论）。总之，最后我们会得到如下的数据结构：

![](react-hooks/useReducer-first-render.png)


### 点击+号
当我们点击 + 号时，会执行两次 `dispatch` 方法：

```javascript

function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {
  // 1
  const update: Update<S, A> = {
    expirationTime,
    suspenseConfig,
    action,
    eagerReducer: null,
    eagerState: null,
    next: (null: any),
  };

  // Append the update to the end of the list.
  const pending = queue.pending;
  if (pending === null) {
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  // 2
  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    ...
  } else {
    if (
      fiber.expirationTime === NoWork &&
      (alternate === null || alternate.expirationTime === NoWork)
    ) {
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher;
        try {
          const currentState: S = (queue.lastRenderedState: any);
          const eagerState = lastRenderedReducer(currentState, action);
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = lastRenderedReducer;
          update.eagerState = eagerState;
          if (is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {
        }
      }
    }

    // 3
    scheduleUpdateOnFiber(fiber, expirationTime);
  }
}

```

我们去掉一些暂时不关心的代码，整个代码就分成了三个部分：

1. 创建一个新的更新，将所有的更新形成一个环状链表并挂载到 `queue.pending` 上面
2. 计算出 `eagerReducer` 和 `eagerState`
3. 在 `FiberNode` 上调度更新（暂时不关心，只需要知道它会开启一个宏任务，在下一个事件循环对组件进行更新）

经过两次 `dispatch` 后，我们的数据结构会变成如下这样：

![](react-hooks/useReducer-dispatch.png)
