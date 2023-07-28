---
title: Vite 打包 Chunks 优化
date: 2023-07-28 14:50:16
tags:
  - rollup
categories:
  - javascript
description: 对 Rollup 的输出结果进行优化
---

项目从 Webpack 迁移到 Vite 后，代码打包出的 chunks 一下增加了很多。老板说这个得优化一下，那自然是在所不辞。

我们知道 Vite 底层是使用 Rollup 构建的，它的理念跟 Webpack 有一些差别，我们来看这个例子：

```js
// index.js
import('./a.js')
import('./b.js')

// a.js
import c from './c.js'

export const fnA = () => {
  return 'a' + c
}

// b.js
import c from './c.js'

export const fnB = () => {
  return 'b' + c
}

// c.js
export default 'c'
```

默认情况下，Vite（4.3.9）构建出来的结果是这样的：

```js
// index-49bb322a.js
...
u(
  () => import('./a-b94a9e8c.js'),
  ['assets/a-b94a9e8c.js', 'assets/c-13f6ff57.js']
)
u(
  () => import('./b-281a48d8.js'),
  ['assets/b-281a48d8.js', 'assets/c-13f6ff57.js']
)
// a-b94a9e8c.js
import{c as r}from"./c-13f6ff57.js";const t=()=>"a"+r;export{t as fnA};

// b-281a48d8.js
import{c as r}from"./c-13f6ff57.js";const t=()=>"b"+r;export{t as fnB};

// c-13f6ff57.js
const o="c";export{o as c};
```

但是，用 Webpack（5.41.0）构建出来只有三个文件（index，a，b），其中 a 和 b 中都有 c 的代码。

这样的后果是 Vite 构建出来的文件数量更多，而 Webpack 构建出来的代码量更多（重复代码加上 Webpack 运行时的代码）。那能否针对 Vite 优化一下呢？其实还是可以的。

通过搜索发现，这个问题其实已经有人给 Rollup 反馈过了（https://github.com/rollup/rollup/issues/4327）。官方也提供了一个参数 `output.experimentalMinChunkSize` 用来指定 chunk 的最小体积，如果 chunk 小于这个值则会尝试跟其他 chunk 合并，还是上面的例子，我们把这个参数设为 1000，打包出来的结果如下：

```js
// index-b9ab0c04.js
...
u(() => import('./b-91d5a685.js').then((n) => n.a), [])
u(() => import('./b-91d5a685.js').then((n) => n.b), [])
// b-91d5a685.js
const e = 'c',
  t = () => 'a' + e,
  n = Object.freeze(
    Object.defineProperty({__proto__: null, fnA: t}, Symbol.toStringTag, {
      value: 'Module',
    })
  ),
  o = () => 'b' + e,
  r = Object.freeze(
    Object.defineProperty({__proto__: null, fn: o}, Symbol.toStringTag, {
      value: 'Module',
    })
  )
export {n as a, r as b}
```

可以看到，a b c 的代码都合并到了一个 chunk 中，看来这个问题就这么简单的搞定了！

但是，别高兴得太早了，事情没那么简单。比如我现在在 a b c 中都加一行代码：

```js
console.log('execute')
```

此时，打包出来的结果就又变成四个 chunk 了。原因在于模块级别的函数调用会被编译器看做是副作用，会影响 chunk 的合并。比如，假设现在 d 依赖 c，引入 c 时会打印 `execute`。如果把 b 和 c 合并以后，则 d 引入 c 时会把 b 中的 `console.log('execute')` 也执行，这种情况有时候会导致 bug。

但是，很明显类似于 `console.log` 这种函数即便意外执行了，也不会有什么大问题，所以 Rollup 还提供了 `treeshake.manualPureFunctions` 参数来让开发者指定哪些函数是纯函数，所以可以这样配置：

```js
output: {
  experimentalMinChunkSize: 1000,
},
treeshake: {
  preset: 'recommended',
  manualPureFunctions: ['console.log'],
},
```

这样 chunks 又可以合并了。

但是这样的配置只适合函数不重名的场景，比如 a b 中都有一个方法 fn 在模块级别调用了：

```js
// a.js
const fn = () => {
  localStorage.setItem('a', 1)
}
fn()

// b.js
const fn = () => {
  console.log('b')
  return 'b'
}
fn()
```

显然 a 中的有副作用，b 中尽管有 `console.log` 但是可以当做纯函数。针对这种情况可以使用 `annotation` 来声明函数是没有副作用的：

```js
// @__NO_SIDE_EFFECTS__
const fn = () => {
  console.log('b')
  return 'b'
}
fn()
```

也可以在函数调用的时候，通过 `@__PURE__` 来声明：

```js
const fn = () => {
  console.log('b')
  return 'b'
}
/*@__PURE__*/ fn()
```

好了，有了以上的这些方法，这个问题看来就轻松解决了。别急，还有一种情况也会产生副作用，比如：

```js
// a.js
import c from './c.js'

export const fnA = () => {
  return 'a' + c
}

const a = fnA.a
// OR
fnA.a = 1
```

因为编译器认为读取属性或给属性赋值可能会触发 `get` 或 `set` 方法，相当于执行了函数。针对这种代码，可以采取这种“黑科技”：

```js
const a = /*@__PURE__*/;(() => fnA.a)()
// OR
/*@__PURE__*/;(() => fnA.a = 1)()
```

应用了这些方法后，chunks 减少了一半以上，优化效果还是挺明显的。同时，通过这次优化，也告诉我们在开发 JS 模块的时候要尽量避免模块副作用，将模块级别中的函数调用比如模块的初始化等，交给模块的使用方来做。
