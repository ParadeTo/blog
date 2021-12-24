---
title: React Native 拆包实战（一）
date: 2021-12-24 14:16:59
tags:
  - react native
  - 拆包
categories:
  - javascript
description: 这是 React Native 拆包实战的第一部分，也就是介绍如何进行拆包
---

# 引言

React Native 应用默认会将我们的 JS 代码打包成一个文件，当我们的 React Native 应用变得很庞大了以后，一次性下载所有 JS 代码往往耗时很长，这时我们可能会想到可以通过按需加载来进行优化，而按需加载的首要任务就是对代码进行拆分。本文会一步步揭示 React Native 拆包的秘密。

# Metro 介绍

因为 React Native 使用 Metro 来进行打包，所以我们得先来了解一下它，研究一个打包器最好的方式就是先看看它的构建产物。

## 构建产物分析

假设我们有如下代码：

```javascript
// index.js
const {say} = require('./utils')

say('就是开不了口让她知道')

// utils.js
exports.say = (word) => console.log(word)
```

我们使用 Metro 对其进行打包（需要安装 metro 和 metro-core）：

```js
metro build index.js --out bundle.js -z false
```

其中 `-z` 表示是否对代码进行 minify，为了方便查看，我们选择 `false`。

打包后的文件如下所示（省略掉了前面的代码）：

```js
...
__d(
  function (
    global,
    _$$_REQUIRE,
    _$$_IMPORT_DEFAULT,
    _$$_IMPORT_ALL,
    module,
    exports,
    _dependencyMap
  ) {
    'use strict'

    const {say} = _$$_REQUIRE(_dependencyMap[0])

    say('就是开不了口让她知道')
  },
  0,
  [1]
)
__d(
  function (
    global,
    _$$_REQUIRE,
    _$$_IMPORT_DEFAULT,
    _$$_IMPORT_ALL,
    module,
    exports,
    _dependencyMap
  ) {
    'use strict'

    exports.say = (word) => console.log(word)
  },
  1,
  []
)
__r(0)
```

### \_\_d

`__d` 是 define 的意思，即定义一个模块：

```js
;(function (global) {
  'use strict'

  global[`${__METRO_GLOBAL_PREFIX__}__d`] = define

  var modules = clear()
  function clear() {
    modules = Object.create(null)
    return modules
  }

  function define(factory, moduleId, dependencyMap) {
    if (modules[moduleId] != null) {
      return
    }

    const mod = {
      dependencyMap,
      factory,
      hasError: false,
      importedAll: EMPTY,
      importedDefault: EMPTY,
      isInitialized: false,
      publicModule: {
        exports: {},
      },
    }
    modules[moduleId] = mod
  }
  //...
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : typeof window !== 'undefined'
    ? window
    : this
)
```

`define` 函数接受 3 个参数，`factory` 是模块的工厂方法，`moduleId` 是模块的 id，`dependencyMap` 是模块的依赖列表，里面存储的是所依赖的其他模块的 id。这个函数很简单，生成了一个 `mod`，然后保存到了 modules 中而已。

### \_\_r

`__r` 有点复杂，不过我们顺藤摸瓜，最后会来到这个函数：

```js
function loadModuleImplementation(moduleId, module) {
  ...
  module.isInitialized = true
  const {factory, dependencyMap} = module

  try {
    const moduleObject = module.publicModule
    moduleObject.id = moduleId
    factory(
      global,
      metroRequire,
      metroImportDefault,
      metroImportAll,
      moduleObject,
      moduleObject.exports,
      dependencyMap
    )
    {
      module.factory = undefined
      module.dependencyMap = undefined
    }
    return moduleObject.exports
  } catch (e) {
    //...
  } finally {
  }
}
```

该函数通过模块 id 从 `modules` 中获取到该模块，然后执行模块的工厂方法，方法里面会对传进去的 `exports` 对象进行一些修改（比如下面这个模块在 `exports` 上面添加了字段 `say`），最后返回修改后的 `exports` 对象。

```js
__d(
  function (
    global,
    _$$_REQUIRE,
    _$$_IMPORT_DEFAULT,
    _$$_IMPORT_ALL,
    module,
    exports,
    _dependencyMap
  ) {
    'use strict'

    exports.say = (word) => console.log(word)
  },
  1,
  []
)
```

回到上面的例子，我们现在其实可以手动对其进行拆包了，方法很简单，将打包的产物分成两个文件即可：

```js
// utils.bundle.js
...
__d(
  function (
    global,
    _$$_REQUIRE,
    _$$_IMPORT_DEFAULT,
    _$$_IMPORT_ALL,
    module,
    exports,
    _dependencyMap
  ) {
    'use strict'

    const {say} = _$$_REQUIRE(_dependencyMap[0])

    say('就是开不了口让她知道')
  },
  0,
  [1]
)
// index.bundle.js
__d(
  function (
    global,
    _$$_REQUIRE,
    _$$_IMPORT_DEFAULT,
    _$$_IMPORT_ALL,
    module,
    exports,
    _dependencyMap
  ) {
    'use strict'

    exports.say = (word) => console.log(word)
  },
  1,
  []
)
__r(0)
```

我们只需要保证先加载 `utils.bundle.js`，再加载 `index.bundle.js` 即可。那么如何自动的实现呢？我们先要了解一下 Metro 打包的一些配置才行。

## 配置文件

关于 Metro 的配置文件有如下这些：

```js
module.exports = {
  /* general options */

  resolver: {
    /* resolver options */
  },
  transformer: {
    /* transformer options */
  },
  serializer: {
    /* serializer options */
  },
  server: {
    /* server options */
  },
}
```

但是这里我们只需要了解 `serializer` 即可，即构建产物输出相关的配置，`serializer` 下的配置我们也仅需要了解 `createModuleIdFactory` 和 `processModuleFilter`。

### createModuleIdFactory

该配置用于生成模块的 id，比如当配置成如下所示时：

```js
module.exports = {
  serializer: {
    createModuleIdFactory() {
      return (path) => {
        return path
      }
    },
  },
}
```

打包出的模块将会以文件路径作为模块 id：

```js
...
__d(function (global, _$$_REQUIRE, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  const {
    say
  } = _$$_REQUIRE(_dependencyMap[0]);

  say('就是开不了口让她知道');
},"/demo1/src/index.js",["/demo1/src/utils.js"]);
__d(function (global, _$$_REQUIRE, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  exports.say = word => console.log(word);
},"/demo1/src/utils.js",[]);
__r("/demo1/src/index.js");
```

### processModuleFilter

该配置用于过滤掉模块的输出，还是用一个例子来说明：

```js
// index.js
require('./unused.js')
const {say} = require('./utils')

say('就是开不了口让她知道')

// metro.config.js
```
