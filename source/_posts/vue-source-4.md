---
title: Vue 源码解读之四组件渲染流程
date: 2020-06-29 15:29:13
tags:
  - vue
categories:
  - javascript
description: 源码解读的第四篇文章，组件渲染流程
---

组件化是 `Vue`, `React` 等这些框架的一个核心思想，通过把页面拆成一个个高内聚、低耦合的组件，可以极大程度提高我们的代码复用度，同时也使得项目更加易于维护。所以，本文就来分析下组件的渲染流程。我们通过下面这个例子来进行分析：

```html
<div id="demo">
  <comp></comp>
</div>
<script>
  Vue.component('comp', {
    template: '<div>I am comp</div>',
  })
  const app = new Vue({
    el: '#demo',
  })
</script>
```

这里我们分为两步来分析：组件声明、组件创建及渲染

# 组件声明

首先，我们看下 `Vue.component` 是什么东西，它的声明在 `core/global-api/assets.js`：

```javascript
export function initAssetRegisters(Vue: GlobalAPI) {
  // ASSET_TYPES是数组：['component','directive','filter']
  ASSET_TYPES.forEach((type) => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        // 组件声明相关代码
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          // _base是Vue
          // Vue.extend({})返回组件构造函数
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = {bind: definition, update: definition}
        }
        // 注册到components选项中去
        // 在Vue原始选项上添加组件配置，将来其他组件继承，它们都有这些组件注册
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
```

这里 `this.options._base.extend(definition)` 调用的其实就是 `Vue.extend(definition)`：

```javascript
Vue.extend = function (extendOptions: Object): Function {
  extendOptions = extendOptions || {}
  const Super = this
  const SuperId = Super.cid
  const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
  if (cachedCtors[SuperId]) {
    return cachedCtors[SuperId]
  }

  const name = extendOptions.name || Super.options.name
  if (process.env.NODE_ENV !== 'production' && name) {
    validateComponentName(name)
  }

  const Sub = function VueComponent(options) {
    this._init(options)
  }
  Sub.prototype = Object.create(Super.prototype)
  Sub.prototype.constructor = Sub
  Sub.cid = cid++
  Sub.options = mergeOptions(Super.options, extendOptions)
  Sub['super'] = Super

  // For props and computed properties, we define the proxy getters on
  // the Vue instances at extension time, on the extended prototype. This
  // avoids Object.defineProperty calls for each instance created.
  if (Sub.options.props) {
    initProps(Sub)
  }
  if (Sub.options.computed) {
    initComputed(Sub)
  }

  // allow further extension/mixin/plugin usage
  Sub.extend = Super.extend
  Sub.mixin = Super.mixin
  Sub.use = Super.use

  // create asset registers, so extended classes
  // can have their private assets too.
  ASSET_TYPES.forEach(function (type) {
    Sub[type] = Super[type]
  })
  // enable recursive self-lookup
  if (name) {
    Sub.options.components[name] = Sub
  }

  // keep a reference to the super options at extension time.
  // later at instantiation we can check if Super's options have
  // been updated.
  Sub.superOptions = Super.options
  Sub.extendOptions = extendOptions
  Sub.sealedOptions = extend({}, Sub.options)

  // cache constructor
  cachedCtors[SuperId] = Sub
  return Sub
}
```

这里我们可以理解为返回了一个名叫 `VueComponent` 的构造函数且继承了 `Vue`。所以，这里的组件定义完成后 `Vue` 就会变成这样：

```javascript
{
  ...
  options: {
    components: {
      comp: function VueComponent() {}
    }
  }
  ..
}
```

# 组件创建及挂载

我们知道 `Vue` 中的模板最后会变编译成 `render` 函数，比如上面例子最终的 `render` 函数会如下所示：

```javascript
render() {
  with (this) {return _c('div',{attrs:{"id":"demo"}},[_c('comp')],1)}
}
```

这里 `_c` 的定义可以在 `core/instance/render.js` 中找到：

```javascript
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
```

所以 `_c('comp')` 最终还是调用了 `createElement` (core/vdom/create-element.js) 这个方法：

```javascript
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  ...
  return _createElement(context, tag, data, children, normalizationType)
}

export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  ...
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // 自定义组件
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  ...
}

```

这里我们只看自定义组件的相关逻辑，发现最后调用了 `createComponent` (core/vdom/create-component.js)：

```javascript
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  ...

  // install component management hooks onto the placeholder node
  // 安装组件管理钩子：未来会做组件初始化（实例创建、挂载）
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  return vnode
}
```

这里我们跳过其他的代码，先看看 `installComponentHooks`：

```javascript
function installComponentHooks(data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}
```

这里会在 `data.hook` 上挂载一些 `hooks`，如果用户也传了相同的 `hooks` 则会进行合并。这个 `hooks` 又是啥呢：

```javascript
const componentVNodeHooks = {
  // 实例化和挂载
  init(vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance && // 实例已经存在
      !vnode.componentInstance._isDestroyed && // 未被销毁
      vnode.data.keepAlive // 被标记为keepAlive
    ) {
      // kept-alive components, treat as a patch
      // 对于缓存组件，只需patch即可
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 创建组件实例
      const child = (vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      ))
      // 子组件挂载
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = (vnode.componentInstance = oldVnode.componentInstance)
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert(vnode: MountedComponentVNode) {
    const {context, componentInstance} = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy(vnode: MountedComponentVNode) {
    const {componentInstance} = vnode
    if (!componentInstance._isDestroyed) {
      // 不是缓存组件直接销毁
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  },
}
```

这里有四个 `hooks` ，看他们的名字就知道他们会在对应的操作去执行。比如 `init` 会在组件初始化的时候执行，这个后面碰到了再说。我们继续看 `createComponent`：

```javascript
// return a placeholder vnode
const name = Ctor.options.name || tag
const vnode = new VNode(
  `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
  data,
  undefined,
  undefined,
  undefined,
  context,
  {Ctor, propsData, listeners, tag, children},
  asyncFactory
)

return vnode
```

```javascript
export default class VNode {
  ...
  constructor(
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    ...
    this.componentOptions = componentOptions
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}
```

这里初始化了一个 `VNode` 并进行了返回，到这里 `_c('comp')` 的任务就完成了。可以看到我们的自定义组件的构造函数在这一步并没有执行，仅仅只是挂载到了 `componentOptions` 属性上。那他什么时候执行呢？别急，我们接着往下走。

当根组件的 `render` 执行完后，会执行 `vm._update` 进行组件的更新，然后会调用 `__patch__`，我们顺藤摸瓜最终来到 `core/vdom/patch.js`：

```javascript
return function patch(oldVnode, vnode, hydrating, removeOnly) {
      ...
      // create new node
      createElm(
        vnode,
        insertedVnodeQueue,
        // extremely rare edge case: do not insert if old element is in a
        // leaving transition. Only happens when combining transition +
        // keep-alive + HOCs. (#4590)
        oldElm._leaveCb ? null : parentElm,
        nodeOps.nextSibling(oldElm)
      )
      ...
  return vnode.elm
}
```

然后会走到 `createElm`：

```javascript
function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
  ...
      } else {
        createChildren(vnode, children, insertedVnodeQueue);
        if (isDef(data)) {
          // 事件、属性等等初始化
          invokeCreateHooks(vnode, insertedVnodeQueue);
        }
        // 插入节点
        insert(parentElm, vnode.elm, refElm);
      }
  ...
```

注意到这里的 `vnode` 是 `<div id="demo"></div>` 这个元素的，所以会走到 `createChildren`：

```javascript
function createChildren(vnode, children, insertedVnodeQueue) {
  if (Array.isArray(children)) {
    if (process.env.NODE_ENV !== 'production') {
      checkDuplicateKeys(children)
    }
    for (let i = 0; i < children.length; ++i) {
      createElm(
        children[i],
        insertedVnodeQueue,
        vnode.elm,
        null,
        true,
        children,
        i
      )
    }
  } else if (isPrimitive(vnode.text)) {
    nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
  }
}
```

这里最后又回到了 `createElm`，不过此时的 `vnode` 就是自定义组件了，会走到这里：

```javascript
  function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    ...
    // 自定义组件创建
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return;
    }

```

```javascript
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
  let i = vnode.data
  if (isDef(i)) {
    // 缓存的情况
    const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
    // 前面安装的钩子在这里用到了，执行了 init，自定义组件实例化
    if (isDef((i = i.hook)) && isDef((i = i.init))) {
      i(vnode, false /* hydrating */)
    }
    // after calling the init hook, if the vnode is a child component
    // it should've created a child instance and mounted it. the child
    // component also has set the placeholder vnode's elm.
    // in that case we can just return the element and be done.
    // 假如上面创建过程已完成，组件实例已存在
    if (isDef(vnode.componentInstance)) {
      // 初始化组件：组件上面事件、属性等
      initComponent(vnode, insertedVnodeQueue)
      // 插入dom
      insert(parentElm, vnode.elm, refElm)
      if (isTrue(isReactivated)) {
        reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
      }
      return true
    }
  }
}
```

注意到这里会执行 `i.init` 方法，该方法上文已经说过，会实例化组件对象，然后进行 `$mount`。而执行 `$mount` 最终又会走到 `patch` 方法，并最终执行 `createElm`：

```javascript
function patch(oldVnode, vnode, hydrating, removeOnly) {
  ...
  if (isUndef(oldVnode)) {
    // empty mount (likely as component), create new root element
    isInitialPatch = true;
    createElm(vnode, insertedVnodeQueue);
  }
  ...
}
```

执行该方法又会递归的将自定义组件内的 `vnode` 渲染成真实的 `dom`，最后通过 `insert` 方法将整颗 dom 树插入到父元素之中。到这里自定义组件的渲染过程就结束了。
