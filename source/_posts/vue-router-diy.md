---
title: 手写一个简单的 vue-router
date: 2020-06-13 21:58:55
tags:
  - vue
categories:
  - javascript
description: 手写一个简单的 vue-router
---

# 需求分析

话不多说，直接上代码：

```html
<div id="demo">
  <div>
    <router-link to="/">Home</router-link> |
    <router-link to="/about">About</router-link>
  </div>
  <router-view />
</div>
<script src="https://cdn.bootcdn.net/ajax/libs/vue/2.6.11/vue.js"></script>
<script src="./vue-router.js"></script>
<script>
  const Home = Vue.component('home', {
    template: '<div>Home</div>',
  })
  const About = Vue.component('about', {
    template: '<div>About</div>',
  })
</script>
<script>
  Vue.use(VueRouter)

  const routes = [
    {
      path: '/',
      name: 'Home',
      component: Home,
    },
    {
      path: '/about',
      name: 'About',
      component: About,
    },
  ]

  const router = new VueRouter({
    routes,
  })

  const app = new Vue({
    el: '#demo',
    data: {
      msg: 'hello',
    },
    router,
  })
</script>
```

# 插件基本结构
根据我们 `vue-router` 的使用方式，我们写出插件的基本结构如下：
```javascript
class VueRouter {
  constructor(options) {}
}

VueRouter.install = function (Vue) {}
```
# 初次渲染路由
我们先不考虑路由变化的情况，仅实现第一次渲染。首先我们实现下我们的 `VueRouter`：
```javascript
class VueRouter {
  constructor(options) {
    this.routes = options.routes

    this.routeMap = {}
    this.routes.forEach((route) => {
      this.routeMap[route.path] = route
    })

    // 当前路由
    this.current = window.location.hash.slice(1)
  }
}

```

我们通过一个 `routeMap` 来存储路由和组件的对应关系以方便后续进行索引，同时用一个 `current` 变量来记录当前地址栏中的路由。

然后，我们需要在插件安装的时候定义下我们的 `router-view` 组件：

```javascript
VueRouter.install = function (Vue) {
  Vue.component('router-view', {
    render(h) {
      const {routeMap, current} = ???
      const component = routeMap[current] ? routeMap[current].component : null
      return h(component)
    },
  })
}
```

我们需要拿到路由表以及当前的路由，但是从哪去获取呢？很明显，这个信息存在于 `VueRouter` 实例之上，但是我们执行 `VueRouter.install` 的时候还没有该实例，是不是就没有办法了呢？注意到 `VueRouter` 实例是传递给了 `Vue` 的根实例的，所以我们可以在根组件的生命周期中将 `router` 这个对象共享给所有组件，这样 `router-view` 在渲染的时候就可以拿到所需要的信息了：

```javascript
VueRouter.install = function (Vue) {
  Vue.mixin({
    beforeCreate() {
      // 只有根组件上会有这个
      if (this.$options.router) {
        Vue.prototype.$router = this.$options.router
      }
    }
  })
  Vue.component('router-view', {
    render(h) {
      const {routeMap, current} = this.$router
      const component = routeMap[current] ? routeMap[current].component : null
      return h(component)
    },
  })
}
```

# 监听路由变化
我们使用 `hashchange` 来监听路由的变化，当路由变化的时候将当前 hash 赋值给 `this.current`。当然，为了使得当 `this.current` 发生变化的时候能够触发视图重新渲染，我们需要将 `current` 属性定义为响应式的：
```javascript
class VueRouter {
  constructor(options) {
    ...

    Vue.util.defineReactive(this, 'current', window.location.hash.slice(1))

    window.addEventListener('hashchange', this.onHashChange.bind(this))
  }

  onHashChange() {
    this.current = window.location.hash.slice(1)
  }
}
```

# 实现 router-link
该组件接受一个名为 `to` 的属性，并渲染出一个 `a` 标签，例如：`<a href='#/about'>About</a>`。
```javascript
  Vue.component('router-link', {
    props: {
      to: {
        type: String,
        default: '',
      },
    },
    render(h) {
      return h('a', {attrs: {href: '#' + this.to}}, this.$slots.default)
    },
  })
```

# 总结
本文通过层层递进，最终实现了一个简单的 `vue-router`。把复杂的东西拆解后，一切感觉都是水到渠成啊。