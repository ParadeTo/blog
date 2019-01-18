---
title: react 单元测试
date: 2018-12-28 10:02:53
tags:
- react
- jest
categories:
- javascript
description: 一些奇技淫巧
---

# 如何兼容 `webpack`
`jest` 并不知道 `webpack` 中的 `alias` 和 `NormalModuleReplacementPlugin` 是如何工作的，所以写了一个 `resolver` 来统一解决这个问题：

```javascript
const fs = require('fs')
const resolve = require('resolve')
const path = require('path')

const COUNTRY = (process.env.COUNTRY || 'id').replace(/"/g, '')

const moduleNameMapper = {
  '^react-native$': 'react-native-web',
  '^@const(.*)__APP_COUNTRY__$': `<rootDir>/src/constants$1${COUNTRY}`,
  '^@api(.*)__APP_COUNTRY__$': `<rootDir>/src/apis$1${COUNTRY}`,
  '^@reducer(.*)__APP_COUNTRY__$': `<rootDir>/src/reducers$1${COUNTRY}`,
  '^@src(.*)$': '<rootDir>/src$1',
  '^@const(.*)$': '<rootDir>/src/constants$1',
  '^@comp(.*)$': '<rootDir>/src/components$1',
  '^@container(.*)$': '<rootDir>/src/containers$1',
  '^@helper(.*)$': '<rootDir>/src/helpers$1',
  '^@api(.*)$': '<rootDir>/src/apis$1',
  '^@reducer(.*)$': '<rootDir>/src/reducers$1',
  '^@resource(.*)$': '<rootDir>/resource$1',
  '^@selector(.*)$': '<rootDir>/src/selectors$1',
  '^@hocs(.*)$': '<rootDir>/src/hocs$1',
  '^@assets(.*)$': '<rootDir>/src/assets$1',
  '^@icon(.*)$': '<rootDir>/src/assets/icons$1',
  '^@dpui(.*)$': '<rootDir>/node_modules/dp-common-ui$1',
  '^(.*)__APP_COUNTRY__$': `$1${COUNTRY}`, // 按国家来引入组件，旧版本的做法
  '(.*).(css|less|scss)$': 'identity-obj-proxy' // 处理样式, 这个其实可以配置在 transform 中 style.foo => foo
}

function resolveAlias (filename) {
  for (let k in moduleNameMapper) {
    const reg = new RegExp(k)
    if (reg.test(filename)) {
      const replacedFilename = filename.replace(reg, moduleNameMapper[k])
      return replacedFilename
    }
  }
  return null
}

// 根据运行的国家环境来引入不同的文件
function guessFilename (filename, options) {
  const _path = path.parse(filename)
  let { name, ext, dir } = _path

  if (_path.ext === '') {
    dir = `${dir}/${name}`
    name = 'index'
    ext = '.js'
  }

  const guess = path.format({
    dir,
    base: `${name}.${COUNTRY}${ext}`,
    ext: ext
  })

  if (fs.existsSync(guess)) {
    return guess
  }

  if (fs.existsSync(path.resolve(options.basedir, guess))) {
    return path.resolve(options.basedir, guess)
  }

  return filename
}

module.exports = function (filename, options) {
  let _filename = filename

  const resolvedAlias = resolveAlias(_filename)
  if (resolvedAlias) {
    _filename = resolvedAlias.replace('<rootDir>', options.rootDir)
  }

  return resolve.sync(guessFilename(_filename, options), options)
}

```

# 转换 yml 文件
项目中使用 `yml` 文件来配置接口，`jest` 并不知道如何处理，所以需要编写对应的 `transform`，其作用跟 `webpack` 的 `loader` 类似。
```javascript
'use strict'

var yaml = require('js-yaml')

module.exports = {
  process (src, filename) {
    var obj = yaml.safeLoad(src)
    var apis = obj.apis
    var config = obj.config

    var defaultExport = {}

    var output =
      Object.keys(apis)
        .map(function (name) {
          var api = apis[name]
          var url = api.url
          var options = api.options
          var needs = api.needs
          var meta = api.meta

          url = config.rootUrl ? config.rootUrl + url : url
          options = Object.assign({}, config.options, options)
          meta = Object.assign({}, config.meta, meta)

          defaultExport[name] = {
            name: name,
            url: url,
            options: options,
            meta: meta,
            needs: needs
          }

          return (
            'exports.' +
            name +
            ' = ' +
            JSON.stringify(defaultExport[name]) +
            ';'
          )
        })
        .join('') +
      ('module.exports = ' + JSON.stringify(defaultExport) + ';')
    return output
  }
}

```

# 如何对不同的国家做 snapshot 测试
首先，不同国家的测试文件必须要分不同的目录，就像这样：
```javascript
├── __tests__
│   │   ├── id
│   │   │   ├── __snapshots__
│   │   │   ├── data.js
│   │   │   └── index.test-country.js // must end with ".test-country.js"
│   │   └── th
│   │       ├── __snapshots__
│   │       ├── data.js
│   │       └── index.test-country.js
```

接下来必须保证执行 `npm run test:id` 的时候，只跑 id 目录下的测试用例。很好办，在配置文件中这样配置即可：

```javascript
'testMatch': [
  `<rootDir>/src/**/__tests__/${COUNTRY}/**/*.test-country.{js,jsx,mjs}`,
  '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,mjs}'
],
```

# 统一时区
为了确保时区不同导致测试用例失败，需要统一时区，在测试脚本头部加入如下代码即可：
```javascript
process.env.TZ = 'Asia/Shanghai'
```

# 如何模拟事件
以 `touchstart` 事件为例：

```javascript
let e = new window.Event('touchstart')
e.touches = [ { screenY: startY } ] // 可以定义更多参数
dom.dispatchEvent(e)
```

在测试 `Picker` 组件时，给滚动组件这个操作封装成了如下函数：

```javascript
const scrollPicker = (dom, startY, endY) => {
  let e = new window.Event('touchstart')
  e.touches = [ { screenY: startY } ]
  dom.dispatchEvent(e)
  e = new window.Event('touchmove')
  e.touches = [ { screenY: endY } ]
  dom.dispatchEvent(e)
  e = new window.Event('touchend')
  dom.dispatchEvent(e)
}
```

# 如何模拟 `getBoundingClientRect`
`Picker` 组件中使用该函数来分别得到该组件以及每个可选内容的高度：

```javascript
const rootHeight = rootRef.getBoundingClientRect().height
const itemHeight = this.itemHeight = indicatorRef.getBoundingClientRect().height
```

可以使用如下方法来模拟:

```javascript
const mockedRect = {
  width: 357,
  height: pickerH,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0
}
window.Element.prototype.getBoundingClientRect = jest.fn()
  .mockReturnValueOnce(mockedRect)
  .mockReturnValueOnce({ ...mockedRect, height: itemH })
```

对于多列的情况，比如 n 列，重复调用上面的两个方法 n 次然后赋值给 `window.Element.prototype.getBoundingClientRect` 即可。

# 触发 props 的更新
```javascript
const comp = mount(
  <MultiPicker
      selectedValue={selectedValue}
      onValueChange={value => { selectedValue = value }}
    >
      ...
    </MultiPicker>
  )
```

如上所示，`onValueChange` 触发后，变量 `selectedValue` 得到最新的值，但是 `MultiPicker` 的属性 `selectedValue` 并不能得到更新，所以需要我们去触发：

```javascript
  <MultiPicker
    selectedValue={selectedValue}
    onValueChange={value => { selectedValue = value; comp.setProps({ selectedValue }) }}
  >
      ...
    </MultiPicker>
```

# 使用 `redux-saga-test-plan` 来测试 saga
使用 `redux-saga-test-plan` 来测试 saga 可以减少很多工作量。下面以一个复杂的例子来说明其用法：

```javascript
// saga.js
function * fetchOrderListReqSaga ({ payload }) {
  try {
    ...
    const list = yield call(orderApi.fetchOrderList, {
      query: {
        orderStatus,
        page,
        pageSize
      }
    })
    ...
    yield put(fetchOrderListSucc(list, reset))
  } catch (err) {
    yield put(fetchOrderListFailed())
  }
}

export function * watchFetchOrderList () {
  yield takeLatest(fetchOrderListReq, fetchOrderListReqSaga)
}


// reducer.js
export default {
  // -------------- Order List --------------
  [fetchOrderListSucc]: (state, { payload: { list } }) => {
    return {
      list: combineList(state.list, list) // 合并两个列表，相同的元素只会有一个
    }
  }
  ...
}

// test.js
// 使用闭包，这样就行得到多个 reducer 产生的最终 state
// 否则得到的是最后一个 reducer 对 initialState 的作用结果
const createReducer = (
  defaultState = { order: { ...DEFAULT_STATE } }
) => {
  let _state = defaultState
  return (state, { type, payload }) => {
    if (reducers[type]) {
      _state = { order: reducers[type](_state.order, { payload }) }
    }
    return _state
  }
}

it('fetch to_pay list', () => {
    const firstList = [1]
    const secondList = [1, 2]
    const returnListRsp = ({ args: [{ query }] }) => {
      const rsp = {
        total: 100,
        list: []
      }
      if (query.page === 1) rsp.list = firstList
      else rsp.list = secondList
      return rsp
    }
    return expectSaga(watchFetchOrderList)
      .withReducer(createReducer())
      .hasFinalState({ // assert
        order: {
          list: [1, 2] // 最后的状态
        }
      })
      .provide([
        [matchers.call.fn(orderApi.fetchOrderList), dynamic(returnListRsp)] // mock saga 中的 call 函数
      ])
      // 触发两次获取列表的 action
      .dispatch(
        fetchOrderListReq()
      )
      .dispatch(
        fetchOrderListReq()
      )
      .silentRun()
  })
```