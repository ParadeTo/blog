---
title: Vue 源码解读之三异步更新
date: 2020-06-28 16:10:31
tags:
  - vue
categories:
  - javascript
description: 源码解读的第三篇文章，异步更新
---

`Vue` 是异步更新的，这个我们都知道，所以我们一般会使用 `nextTick` 来确保更新完后执行一些业务逻辑。我一直认为自己已经懂了，但是当我看到这个题目后，发现我似乎又不懂了：

题目：下面的打印顺序？注释掉 `this.name = 'b'` 以后呢？
答案：第一问 2 1，第二问 1 2。

```javascript
<template>
  <div id="app">
    {{name}}
  </div>
</template>

<script>
export default {
  data() {
    return {
      name: 'a'
    }
  },
  mounted() {
    this.name = 'b'
    Promise.resolve().then(() => {
      console.log(1)
    })
    this.$nextTick(() => {
      console.log(2)
    })
  }
};
</script>

```

你答对了吗？

我们还是到源码里找答案吧。

更新逻辑的入口应该去哪找呢，自然我们会想到 `defineProperty` 的 `set` 方法，没错，就是它：

```javascript
set: function reactiveSetter(newVal) {
  const value = getter ? getter.call(obj) : val;
  /* eslint-disable no-self-compare */
  if (newVal === value || (newVal !== newVal && value !== value)) {
    return;
  }
  // #7981: for accessor properties without setter
  if (getter && !setter) return;
  if (setter) {
    setter.call(obj, newVal);
  } else {
    val = newVal;
  }
  childOb = !shallow && observe(newVal);
  dep.notify();
},
```

这里将新值赋值给了 `val` 并调用了 `dep.notify()` 来通知 `Watcher` 进行更新：

```javascript
update () {
  /* istanbul ignore else */
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync) {
    this.run()
  } else {
    queueWatcher(this)
  }
}
```

这里会走到 `queueWatcher(this)`：

```javascript
const id = watcher.id
// 不存在才入队，连续多次修改数据 `Watcher` 也只会入队一次
if (has[id] == null) {
  has[id] = true
  if (!flushing) {
    queue.push(watcher)
  } else {
    // 什么时候会走这里？
    // 例如：当执行某个 watch 时，里面对响应式数据进行赋值触发了另外一个 watch 的更新
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
  // queue the flush
  if (!waiting) {
    waiting = true

    if (process.env.NODE_ENV !== 'production' && !config.async) {
      flushSchedulerQueue()
      return
    }
    // 异步执行 flushSchedulerQueue
    nextTick(flushSchedulerQueue)
  }
}
```

首先通过 `has[id]` 判断当前 `Wathcer` 是不是已经入队过，如果已入队过就不再处理，避免每次修改数据都会进行更新。
然后判断当前是不是正在刷新队列，如果没有则将 `Watcher` 入队。我们先不管其他逻辑，也不急着分析 `nextTick`，我们只需要知道 `flushSchedulerQueue` 总是会在接下来的某个时刻执行就行了，看看它做了啥：

```javascript
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow()
  // 标志当前正在刷新
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher) 因为用户 wathcer 是在 Vue 初始化的时候生成的，渲染 wathcer 是在 $mount 的时候生成的
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    // 每次拿出一个watcher
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    // 真正的操作是run方法做的
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }
}
```

这里先对 `Watcher` 按照 id 从小到大进行排序，因为用户 `Watcher` 是在 Vue 初始化的时候生成的，渲染 `Wathcer` 是在 `$mount` 的时候生成的，所以用户 `Watcher` 会在组件的渲染 `Watcher` 之前执行。然后就是遍历执行 `watcher.run()`：

```javascript
 run () {
    if (this.active) {
      // 执行get方法，如果当前watcher是render watcher
      // 此get会是updateComponent()
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }
```

这里先对比所观察的值有没有变化，这个值就是 `watch` 对象的 key，比如下面的 `name` 和 `obj.age`：

```javascript
watch: {
  name() {

  },
  'obj.age': () => {}
}

```

如果变化了，或者观察的是一个对象，又或者传递了 `deep` 参数，并且是用户 `Watcher`，就会执行回调函数。

现在，让我们先回到 `queueWathcer`，看看下面这段代码是怎么回事：

```javascript
  } else {
    // 什么时候会走这里？
    // 例如：当执行某个 watch 时，里面对响应式数据进行赋值触发了另外一个 watch 的更新
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
```

当我们进入 `else` 的话说明刷新队列的时候又有 `Watcher` 被触发了更新，例如：当执行某个 `watch` 方法时，对响应式数据进行赋值触发了另外一个 `Watcher` 的更新。我们通过下面这个例子来梳理下这个流程：

```html
<div id="demo">
  {{name}} {{age}}
</div>
<script>
  // 组件 Watcher id 为 3
  const app = new Vue({
    el: '#demo',
    data() {
      return {
        name: 'foo',
        age: 18,
      }
    },
    watch: {
      name() {
        // Watcher id 为 1
        this.age = 19
      },
      age() {
        // Watcher id 为 2
        console.log('age')
      },
    },
    mounted() {
      this.name = 'a'
    },
  })
</script>
```

该例子中会有三个 `Wathcer`，当在 `mounted` 中修改 `this.name` 时，此时 `name` 的 `Watcher` 和组件渲染 `Watcher` 都会入队。然后，在“下一帧”的时候，会执行这些 `Watcher`，按照刚才的分析，首先会执行 `name` 的 `Watcher`，这里对 `this.age` 进行了赋值，此时会触发 `age` 的 `Watcher` 入队，因为该 `Watcher` 之前没有入队过，且当前正在刷新队列，所以会走到：

```javascript
  } else {
    // 什么时候会走这里？
    // 例如：当执行某个 watch 时，里面对响应式数据进行赋值触发了另外一个 watch 的更新
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
```

又因为 `age` 的 `Watcher` id 小于组件渲染 `Wathcer` 的 id，所以该 `Watcher` 会插入到当前的队列中。

现在，是时候看看 `nextTick` 了：

```javascript
import {noop} from 'shared/util'
import {handleError} from './error'
import {isIE, isIOS, isNative} from './env'

export let isUsingMicroTask = false

// 回调函数数组
const callbacks = []
let pending = false

// 刷新回调函数数组
function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  // 遍历并执行
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

let timerFunc

/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (
  !isIE &&
  typeof MutationObserver !== 'undefined' &&
  (isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]')
) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true,
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// 将cb函数放入回调队列队尾
export function nextTick(cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    // 异步执行函数
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise((resolve) => {
      _resolve = resolve
    })
  }
}
```

这个文件首先是经过一系列的特性判断来决定使用哪个 API 来实现异步，并最终以 `timerFunc` 方法提供给 `nextTick` 来调用。而 `nextTick` 中会把传入的回调函数放入 `callbacks`，且第一次调用的时候因为 `pending` 为 `false`，所以会执行 `timerFunc` 开启一个宏/微任务，最终会在将来执行 `flushCallbacks` 这个方法，该方法就是把 `callbacks` 中的函数都执行一遍，并重置 `pending` 为 `false`。

到此，异步更新逻辑分析的就差不多了。现在，让我们来回答一下一开始的那个问题：

题目：下面的打印顺序？注释掉 `this.name = 'b'` 以后呢？

```javascript
<template>
  <div id="app">
    {{name}}
  </div>
</template>

<script>
export default {
  data() {
    return {
      name: 'a'
    }
  },
  mounted() {
    this.name = 'b'
    Promise.resolve().then(() => {
      console.log(1)
    })
    this.$nextTick(() => {
      console.log(2)
    })
  }
};
</script>

```

第一问。因为 `this.name = 'b'` 会触发 `Watcher` 的更新，此时会开启一个异步的任务，在最新的 Chrome 浏览器中会使用微任务（我们叫它 task1 吧）来实现。 `Promise.resolve().then` 中的回调函数也会放到微任务队列当中，并放在 task1 的后面。当执行 `this.$nextTick` 时，会把回调函数放到 `callbacks`，但是他的执行还是在 task1 的任务之中的。所以这里打印顺序就是 2 1。

第二问。`Promise.resolve().then` 执行的时候回调函数会被放入微任务队列中， 然后执行 `this.$nextTick` 的时候又会开启一个微任务，放在微任务队列的队尾。所以下一次清空微任务队列的时候，打印的顺序就是 1 2 了。
