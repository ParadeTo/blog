---
title: 手写一个简单的 vuex
date: 2020-06-14 10:05:13
tags:
  - vue
  - vuex
categories:
  - javascript
description: 手写一个简单的 vuex
---

# 需求分析

话不多说，直接上代码：

```html
<div id="demo">
  <div>{{$store.state.counter}}</div>
  <div>{{$store.getters.doubleCounter}}</div>
  <button @click="add">Add</button>
</div>
<script src="https://cdn.bootcdn.net/ajax/libs/vue/2.6.11/vue.js"></script>
<script src="./vuex.js"></script>
<script>
  Vue.use(Vuex)
  const store = new Vuex.Store({
    state: {
      counter: 0,
    },
    mutations: {
      add(state) {
        state.counter++
      },
    },
    actions: {
      add({commit}) {
        setTimeout(() => {
          commit('add')
        }, 1000)
      },
    },
    getters: {
      doubleCounter: (state) => {
        return state.counter * 2
      },
    },
  })

  new Vue({
    el: '#demo',
    store,
    methods: {
      add() {
        this.$store.dispatch('add')
      },
    },
  })
</script>
```

# 插件基本结构

根据我们 `vuex` 的使用方式，我们写出插件的基本结构如下：

```javascript
class Store {
  constructor(options) {}
}

const install = function (Vue) {}

const Vuex = {
  Store,
  install,
}
```

# 实现取值功能

先不考虑 `getters`， 我们实现下最基本的取值功能：

```javascript
class Store {
  constructor(options) {
    const {state, mutations, actions} = options
    Vue.util.defineReactive(this, '_state', state)
  }

  get state() {
    return this._state
  }

  set state(val) {
    console.warn('这样做不太好吧')
  }
}

const install = function (Vue) {
  Vue.mixin({
    beforeCreate() {
      // 只有根组件上面会有这个
      if (this.$options.store) {
        Vue.prototype.$store = this.$options.store
      }
    },
  })
}
```

我们在 `Store` 中通过拦截器实现了外部对 `state` 的只读功能，内部则通过一个变量 `_state` 来进行数据的存储和修改。这里必须要将该数据定义成响应式数据，因为视图的更新是依赖于 `_state` 的变化的。同时，我们在插件安装的时候混入了生命周期 `beforeCreate`，因为 `this.$options.store` 只会存在于根 `Vue` 实例，所以这里只会执行一次，并将 `store` 这个实例挂载到原型上共享给所有子组件。

# 实现数据操作功能

数据操作功能主要涉及到 `commit` 和 `dispatch` 两个函数，这两个函数很简单，就是找到对应的 `mutation` 或 `action`， 并执行。这里为了 hold 住用户各种奇怪的调用场景，直接把这两个函数的执行上下文绑定为当前 `Store` 实例，避免出错。

```javascript
class Store {
  constructor(options) {
    ...

    this._mutations = mutations
    this._actions = actions
    this.commit = this.commit.bind(this)
    this.dispatch = this.dispatch.bind(this)
  }

  commit(type, payload) {
    const entry = this._mutations[type]

    if (!entry) {
      console.error('没有这个mutation')
      return
    }

    entry(this.state, payload)
  }

  dispatch(type, payload) {
    const entry = this._actions[type]

    if (!entry) {
      console.error('没有这个action')
      return
    }

    entry(this, payload)
  }
  ...
}
```

# 实现 getters

注意到我们的每一个 `getter` 是一个函数，但是我们在使用的时候是直接访问的 `getter` 的属性名，所以在 `Store` 类中，需要把访问属性转换为执行函数，并返回结果。要实现这个功能，很快想到可以使用 `defineProperty`。同时，每一个 `getter` 可以接受 `state` 作为函数的第一个参数，所以我们还得再封装一层，把当前实例的 `_state` 传递过去：

```javascript
class Store {
  constructor(options) {
    const {state, mutations, actions, getters} = options

    ...

    this.getters = {}
    Object.keys(getters).forEach((key) => {
      const fn = () => getters[key](this._state)
      Object.defineProperty(this.getters, key, {
        get() {
          return fn()
        },
      })
    })
  }
  ...
```

至此，一个简单的 `vuex` 就实现了。
