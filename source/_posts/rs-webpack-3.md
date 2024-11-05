---
title: 从零实现 webpack，但 Rust 版 - [3] 使用 NAPI-RS 为 Node.js 开发插件
date: 2024-10-30 16:48:52
tags:
  - webpack
  - rust
categories:
  - rust
description: 使用 rust 实现一个简单的 webpack
---

> 参考 [mini-webpack](https://github.com/lizuncong/mini-webpack)，使用 Rust 从零实现一个简单的 webpack，深入理解 webpack 的同时，还锻炼了 Rust 的技能，简直赢麻了！
>
> 代码地址：https://github.com/ParadeTo/rs-webpack
>
> 本文对应 Pull Request：https://github.com/ParadeTo/rs-webpack/pull/4

标题似乎与本系列风马牛不相及，用 Rust 实现 webpack 怎么就涉及到了 Node.js 的插件开发了，别急，待我先解释一下。回想一下，我们使用 webpack 进行打包时，是不是经常会执行下面这个命令：

```bash
webpack --config webpack.config.js
```

同样的，我们的 RS Webpack 也想支持这样的命令，但是 Rust 中怎么去得到 `webpack.config.js` 中导出的内容呢？我能想到的是需要有个 JS Runtime 去运行 `webpack.config.js`，但是感觉这样未免有点太重了，而且还涉及到 JS Runtime 需要能把 `webpack.config.js` 中的内容在 Rust 中还原出来，找了一圈发现没有什么好用的工具，所以只能另辟蹊径了。

查阅 [Rspack](https://rspack.dev/) 源码发现，它是利用 NAPI-RS 给 Node.js 开发插件来实现的。具体做法是使用 Rust 来编写打包器的核心代码，使用 NAPI-RS 编译成插件供 Node.js 端调用，而 Node.js 端负责配置文件的导入与解析，并作为参数传给 Rust 提供出来的接口。

如何使用 NAPI-RS，可以参考[官网](https://napi.rs/docs/introduction/getting-started)，这篇文章主要介绍如何将我们的项目改造成我们需要的结果。

首先，我们把我们的项目结构改成如下这样：

```bash
.
├── Cargo.lock
├── Cargo.toml
├── crates // Rust crates
│   ├── rswebpack_binding // Generate by napi
│   └── rswebpack_core
├── packages // JS packages
│   └── rswebpack-cli
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── readme.md
```

- `crates` 下面放的是 Rust 项目，`rswebpack_binding` 是由 NAPI 自动生成的，主要用于导出接口，`rswebpack_core` 是核心库，上一篇文章的相关代码都移动到了这里面
- `packages` 下面放的是 JS 项目，`rswebpack-cli` 最终会发布成命令行工具。

其中，`rswebpack_binding` 中的代码比较简单，仅仅是在原来的 `Compiler` 上包装了一下：

```rs
// lib.rs
#![deny(clippy::all)]

use napi::Result;
use raw_config::RawConfig;
use rs_webpack_core::compiler::Compiler;
#[macro_use]
extern crate napi_derive;

mod raw_config;

#[napi]
pub struct RsWebpack {
  compiler: Box<Compiler>,
}

#[napi]
impl RsWebpack {
  #[napi(constructor)]
  pub fn new(raw_config: RawConfig) -> Result<Self> {
    let config = raw_config.try_into().expect("Config transform error");
    Ok(Self {
      compiler: Box::new(Compiler::new(config)),
    })
  }

  #[napi]
  pub fn run(&mut self) {
    self.compiler.as_mut().run();
  }
}

// raw_config.rs
use rswebpack_core::config::{Config, Output};

#[napi(object)]
pub struct RawOutput {
  pub path: String,
  pub filename: String,
}

impl TryFrom<RawOutput> for Output {
  type Error = ();

  fn try_from(value: RawOutput) -> Result<Self, Self::Error> {
    Ok(Output {
      path: value.path.into(),
      filename: value.filename.into(),
    })
  }
}

#[napi(object)]
pub struct RawConfig {
  pub root: String,
  pub entry: String,
  pub output: RawOutput,
}

impl TryFrom<RawConfig> for Config {
  type Error = ();

  fn try_from(value: RawConfig) -> Result<Self, Self::Error> {
    Ok(Config {
      root: value.root.into(),
      entry: value.entry.into(),
      output: value.output.try_into()?,
    })
  }
}
```

这里新定义了 `RawConfig` 用于接收 JS 传入的配置，然后还规定了 `RawConfig` 如何转换为 `Config`，不过目前转换规则非常简单。

而 `rswebpack-cli` 就更简单了，只需要解析命令行参数，读取配置，然后调用插件导出的接口就行：

```js
#!/usr/bin/env node
const path = require('path')
const {RsWebpack} = require('@rswebpack/binding')

const argv = require('yargs-parser')(process.argv.slice(2))

const config = require(path.resolve(
  process.cwd(),
  argv.config || 'rswebpack.config.js'
))

const rsWebpack = new RsWebpack(config)
rsWebpack.run()
```

别忘了 `package.json` 中配置好命令的名字：

```json
{
  "name": "@rswebpack/cli",
  "dependencies": {
    "@rswebpack/binding": "workspace:*",
    "yargs-parser": "^21.1.1"
  },
  "bin": {
    "rswebpack": "./index.js"
  }
}
```

然后 `npm link` 一下，之后我们新建一个目录：

```js
.
├── const.js
├── index.js
└── rswebpack.config.js
```

其中 `rswebpack.config.js` 内容如下所示：

```js
const path = require('path')

module.exports = {
  root: path.resolve(__dirname),
  entry: 'index.js',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'bundle.js',
  },
}
```

之后，执行 `rswebpack --config rswebpack.config.js`，如果能正常输出 `bundle.js` 则说明改造成功。
