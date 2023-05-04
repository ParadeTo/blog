---
title: 浅析 React Server Component
date: 2023-04-25 14:40:52
tags:
  - react
categories:
  - javascript
description: 浅析 React Server Component
---

<!-- https://www.thearmchaircritic.org/mansplainings/react-server-components-vs-server-side-rendering#:~:text=RSC%20differs%20from%20SSR%20by,browser%20when%20SSR%20is%20used. -->

[React Server Component](https://github.com/reactjs/rfcs/pull/188) 这个概念已经提出很久了，但是一直对其一知半解，这次就借五一小长假来搞清楚吧。我们通过官网的[例子](https://github.com/reactjs/server-components-demo)来学习一下，不过这个例子还需要安装 postgres，为了简单起见我们用另外一个 [fork](https://github.com/pomber/server-components-demo/) 的版本。

## 浅玩 Server Component Demo

安装好依赖并启动后，在浏览器中打开 `http://localhost:4000`，可以看到如下页面：

![](./react-server-component/1.png)

这是一个简单的“笔记”应用（App 组件），左侧包含搜索（SearchField）、新增按钮（EditButton）、笔记列表（NoteList）等组件，右侧是详情或新增笔记组件（Note）。其中蓝色组件为 Client Component（只在 client 端渲染），红色为 Server Component（只在 server 端渲染）。另外，还有一种 Shared Component，即同时可以用在两端的组件，当其被 Client Component 引入时就成为 Client Component，反之亦然。

所谓 Server Component，就是只在 server 端进行渲染，其代码不会出现在客户端：
![](./react-server-component/2.png)

这样的好处是可以节省掉很多 JS 代码的传输，使得客户端更加轻量。

既然在 server 端进行渲染，那 Server Component 中就可以使用很多服务端的 API，比如通过 SQL 从数据库获取数据：

![](./react-server-component/3.png)

这样无疑是有助于性能提升的，原来渲染一个组件需要先下载 JS 代码，然后通过 API 请求获取数据再渲染，现在直接获取到的就是在 server 端渲染好的序列化后的组件，节省了一次网络请求。

那么，它到底是怎么实现的呢？接下来让我们来简单剖析一下。

## 浅析 Server Component 实现原理

我们先从 Client 端入口看起：

```js
export default function Root({initialCache}) {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary FallbackComponent={Error}>
        <Content />
      </ErrorBoundary>
    </Suspense>
  )
}

function Content() {
  const [location, setLocation] = useState({
    selectedId: null,
    isEditing: false,
    searchText: '',
  })
  const response = useServerResponse(location)
  return (
    <LocationContext.Provider value={[location, setLocation]}>
      {response.readRoot()}
    </LocationContext.Provider>
  )
}

export function useServerResponse(location) {
  const key = JSON.stringify(location)
  const cache = unstable_getCacheForType(createResponseCache)
  let response = cache.get(key)
  if (response) {
    return response
  }
  response = createFromFetch(
    fetch('/react?location=' + encodeURIComponent(key))
  )
  cache.set(key, response)
  return response
}
```

上面的代码有两个关键点：

1. 页面如何渲染取决于 `response.readRoot()` 的返回
2. 调用 `useServerResponse` 会发起一个 `/react?location=` 的请求

第一次渲染的时候，由于 `/react?location=` 请求还没有返回，`response.readRoot()` 会 throw 一个 `Chunk` 对象：

![](./react-server-component/4.png)

之前在 [React 之 Suspense](/2022/04/03/react-suspense/) 中有提到过 React 在进行渲染时有 try catch 的逻辑，不过那里的 error 是 Promise 对象，这里是 `Chunk` 对象而已。同样的，React 会 catch 住这个错误，并显示最近 Suspense 的 fallback，等到 `Chunk` 准备好了才会开始渲染。

接下来我们看看 `/react?location=` 的返回内容：

![](./react-server-component/5.png)

该数据中，每一行表示一个 `Chunk`，每一行格式如下：

第一个字母表示 `Chunk` 的类型。M 表示 Module，等于 Webpack 中的 Module，即我们写的组件；S 表示 Symbol，即 React 的内置组件；J 表示 Model，用于描述整个应用的模型。

第二个数字表示 `Chunk` 的编号，可以通过它来唯一索引一个 `Chunk`。

冒号后面的内容表示 `Chunk` 的具体数据。

对于这个 Demo，`readRoot` 时会去获取第 0 个 `Chunk`，我们把它格式化一下：

```json
[
  "$",
  "div",
  null,
  {
    "className": "main",
    "children": [
      [
        "$",
        "section",
        null,
        {
          "className": "col sidebar",
          "children": [
            [
              "$",
              "section",
              null,
              {
                "className": "sidebar-header",
                "children": [
                 ...
                ]
              }
            ],
            [
              "$",
              "section",
              null,
              {
                "className": "sidebar-menu",
                "role": "menubar",
                "children": [
                  ["$", "@1", null, {}],
                  ["$", "@2", null, {"noteId": null, "children": "New"}]
                ]
              }
            ],
            ...
          ]
        }
      ],
      ...
    ]
  }
]
```

经过格式化后是不是很眼熟。其实他就是 `App.server.js` 中组件 `App` 序列化后的数据：

```js
export default function App({selectedId, isEditing, searchText}) {
  return (
    <div className='main'>
      <section className='col sidebar'>
        <section className='sidebar-header'>
          <img
            className='logo'
            src='logo.svg'
            width='22px'
            height='20px'
            alt=''
            role='presentation'
          />
          <strong>React Notes</strong>
        </section>
        <section className='sidebar-menu' role='menubar'>
          <SearchField />
          <EditButton noteId={null}>New</EditButton>
        </section>
        <nav>
          <Suspense fallback={<NoteListSkeleton />}>
            <NoteList searchText={searchText} />
          </Suspense>
        </nav>
      </section>
      <section key={selectedId} className='col note-viewer'>
        <Suspense fallback={<NoteSkeleton isEditing={isEditing} />}>
          <Note selectedId={selectedId} isEditing={isEditing} />
        </Suspense>
      </section>
    </div>
  )
}
```

这个序列化的数据返回给 client 后会被重新解析成 `ReactElement` 对象：

![](./react-server-component/6.png)

其中，数据中 `sidebar-menu` 的 `children` 是这样表示的：

```js
...
className: 'sidebar-menu',
children: [
  ['$', '@1', null, {}],
  ['$', '@2', null, {noteId: null, children: 'New'}],
],
...
```

这里的 `@1`, `@2` 表示其子组件分别是 1 号 和 2 号 Client Component：

![](./react-server-component/5.png)

这里还有一个值得学习的地方是在将 JSON 数据格式化为 `ReactElement` 时使用了 `JSON.parse` 的第二个参数，我们可以通过一个简单的例子来练习一下:

```js
const jsonStr = JSON.stringify([
  'div',
  {
    className: 'cls1',
    children: [
      ['span', {className: 'cls2', children: 'Hello'}],
      ['span', {className: 'cls3', children: 'World'}],
    ],
  },
])

const dom = JSON.parse(jsonStr, (key, value) => {
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const ele = document.createElement(value[0])
    ele.className = value[1].className
    const children = value[1].children
    if (Array.isArray(children)) {
      children.forEach((child) => ele.appendChild(child))
    } else {
      ele.appendChild(document.createTextNode(children))
    }
    return ele
  }
  return value
})

console.log(dom.outerHTML)
```
