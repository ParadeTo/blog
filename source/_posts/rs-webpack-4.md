---
title: 从零实现 webpack，但 Rust 版 - [4] 实现插件系统
date: 2024-11-04 10:45:37
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
> 本文对应 Pull Request：https://github.com/ParadeTo/rs-webpack/pull/5

我们知道，Webpack 中使用了 Tapable 来实现插件系统，既然如此，那我们仿照着写一个 Rust 版本的不就可以了。话虽如此，但是实现起来发现并不是那么的简单，以 `SyncHook` 为例，一个非常简单的版本可以像如下方式用 JS 实现：

```js
class SyncHook {
  constructor() {
    this.taps = []
  }
  tap(options, fn) {
    this.taps.push(fn)
  }
  call() {
    this.taps.forEach((fn) => fn(...arguments))
  }
}

const hook = new SyncHook(['param1', 'param2']) // 创建钩子对象
hook.tap('event1', (param) => console.log('event1:', param))
hook.tap('event2', (param) => console.log('event2:', param))
hook.tap('event3', (param, param2) => console.log('event3:', param, param2))
hook.call('hello', 'world')
```

我们尝试用 Rust 来实现，可能会写出这样的代码：

```rust
struct SyncHook<Arg: Copy, R> {
    taps: Vec<Box<dyn Fn(Arg) -> R>>
}

impl<Arg: Copy, R> SyncHook<Arg, R> {
    fn tap(&mut self, f: Box<dyn Fn(Arg) -> R>) {
        self.taps.push(f);
    }

    fn call(&self, a: Arg) {
        for tap in self.taps.iter() {
            tap(a);
        }
    }
}

fn main() {
    let mut sync_hook = &mut SyncHook{taps: vec![]};
    sync_hook.tap(Box::new(|arg| {
        println!("event {}", arg);
    }));
    sync_hook.call("hello")
}

```

注意，`Arg` 必须约束为可 `Copy`，否则调用 `tap(a)` 的时候会报错。上述代码可以正常运行，但是只能支持 `call` 传入一个参数的情形，不过这个可以通过宏来解决，我们可以预先生成一批支持不同个数参数的 struct：

```rust
struct SyncHook1<Arg1: Copy, R> {
    taps: Vec<Box<dyn Fn(Arg1) -> R>>
}

struct SyncHook2<Arg1: Copy, Arg2: Copy, R> {
    taps: Vec<Box<dyn Fn(Arg1, Arg2) -> R>>
}
```

不过，还有一个问题，它不支持传入 `&mut T` 类型的参数：

```rs

struct Compiler {
    name: String
}

fn main() {
    let mut sync_hook = &mut SyncHook{taps: vec![]};
    sync_hook.tap(Box::new(|arg| {
        println!("event {}", arg);
    }));
    let compiler = &mut Compiler {name: String::from("test")};
    sync_hook.call(compiler)
}
```

上述代码会报 "the trait `Copy`is not implemented for`&mut Compiler`" 的错误。

看来实现类似的功能目前对于我这个初学者来说应该是个比较难的问题，那还是抄作业吧，看看 Rspack 是怎么做的。
查阅发现，Rspack 中没有通用的 `SyncHook`，它通过宏为每个 Hook 单独进行了定义，接下来我们尝试把他接过来。

首先，我们把 Rspack 源码中的 `crates/rspack_macros` 和 `crates/rspack_hook` 的代码都拷贝到 rs-webpack 的 crates 目录下，并修改目录名：

```rs
├── crates
│   ├── rswebpack_hook
│   └── rswebpack_macros

```

然后，新增 `crates/rswebpack_error` 作为我们统一的错误处理模块:

```rs
// lib.rs
use anyhow::Result as AnyhowResult;

pub type Result<T> = AnyhowResult<T>;
```

最后，把这些库里面的依赖项也做相应的修改，比如 `rswebpack_hook` 中的 `Result` 要从原来的 `rspack_error::Result` 改成 `rswebpack_error::Result`。

我们写个 Demo 测试下：

```rs
use rswebpack_macros::{define_hook, plugin, plugin_hook};

struct People {
    name: String
}

define_hook!(Test: SyncSeries(people: &mut People));

#[plugin]
struct TestHookTap1;

#[plugin_hook(Test for TestHookTap1)]
fn test1(&self, people: &mut People) -> Result<()> {
    people.name += " tap1";
    Ok(())
}

#[plugin]
struct TestHookTap2;

#[plugin_hook(Test for TestHookTap2)]
fn test2(&self, people: &mut People) -> Result<()> {
    people.name += " tap2";
    Ok(())
}

fn main() {
    let mut test_hook = TestHook::default();
    test_hook.tap(test1::new(&TestHookTap1::new_inner()));
    test_hook.tap(test2::new(&TestHookTap2::new_inner()));
    let people = &mut People { name: "ayou".into() };
    test_hook.call(people);
    println!("{}", people.name); // ayou tap1 tap2
}
```

稍微解释一下上面的代码，首先通过 `define_hook!(Test: SyncSeries(people: &mut People));` 定义了一个 Hook，它展开其实是这样的：

```rs
pub trait Test {
    fn run(&self, people: &mut People) -> rswebpack_hook::__macro_helper::Result<()>;
    fn stage(&self) -> i32 { 0 }
}
pub struct TestHook {
    taps: Vec<Box<dyn Test + Send + Sync>>,
    interceptors: Vec<Box<dyn rswebpack_hook::Interceptor<Self> + Send + Sync>>,
}
impl rswebpack_hook::Hook for TestHook {
    type Tap = Box<dyn Test + Send + Sync>;
    fn used_stages(&self) -> rswebpack_hook::__macro_helper::FxHashSet<i32> { rswebpack_hook::__macro_helper::FxHashSet::from_iter(self.taps.iter().map(|h| h.stage())) }
    fn intercept(&mut self, interceptor: impl rswebpack_hook::Interceptor<Self> + Send + Sync + 'static) { self.interceptors.push(Box::new(interceptor)); }
}
impl std::fmt::Debug for TestHook { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "TestHook") } }
impl Default for TestHook { fn default() -> Self { Self { taps: Default::default(), interceptors: Default::default() } } }
impl TestHook {
    pub fn call(&self, people: &mut People) -> rswebpack_hook::__macro_helper::Result<()> {
        let mut additional_taps = std::vec::Vec::new();
        for interceptor in self.interceptors.iter() { additional_taps.extend(interceptor.call_blocking(self)?); }
        let mut all_taps = std::vec::Vec::new();
        all_taps.extend(&self.taps);
        all_taps.extend(&additional_taps);
        all_taps.sort_by_key(|hook| hook.stage());
        for tap in all_taps { tap.run(people)?; }
        Ok(())
    }
    pub fn tap(&mut self, tap: impl Test + Send + Sync + 'static) { self.taps.push(Box::new(tap)); }
}
```

可以看到 `TestHook` 跟我们之前的实现方式是有点类似的，同时它还生成了 `TestHook` 的 `tap` 的类型，即 `Test`。

之后，还是通过宏来实现一个 `Test` 的 `Tap`：

```rs
#[plugin]
struct TestHookTap1;

#[plugin_hook(Test for TestHookTap1)]
fn test1(&self, people: &mut People) -> Result<()> {
    people.name += " tap1";
    Ok(())
}
```

它展开其实是这样的：

```rs
struct TestHookTap1 {
    inner: ::std::sync::Arc<TestHookTap1Inner>,
}
impl TestHookTap1 {
    fn new_inner() -> Self { Self { inner: ::std::sync::Arc::new(TestHookTap1Inner) } }
    fn from_inner(inner: &::std::sync::Arc<TestHookTap1Inner>) -> Self { Self { inner: ::std::sync::Arc::clone(inner) } }
    fn inner(&self) -> &::std::sync::Arc<TestHookTap1Inner> { &self.inner }
}
impl ::std::ops::Deref for TestHookTap1 {
    type Target = TestHookTap1Inner;
    fn deref(&self) -> &Self::Target { &self.inner }
}
#[doc(hidden)]
pub struct TestHookTap1Inner;

#[allow(non_camel_case_types)]
struct test1 {
    inner: ::std::sync::Arc<TestHookTap1Inner>,
}
impl test1 { fn new(plugin: &TestHookTap1) -> Self { test1 { inner: ::std::sync::Arc::clone(plugin.inner()) } } }
impl TestHookTap1 {
    #[allow(clippy::ptr_arg)]
    fn test1(&self, people: &mut People) -> Result<()> {
        people.name += " tap1";
        Ok(())
    }
}
impl ::std::ops::Deref for test1 {
    type Target = TestHookTap1Inner;
    fn deref(&self) -> &Self::Target { &self.inner }
}
impl Test for test1 {
    #[tracing::instrument(name = "TestHookTap1::test1", skip_all)]
    fn run(&self, people: &mut People) -> Result<()> {
        TestHookTap1::test1(&TestHookTap1::from_inner(&self.inner), people )
    }
}
```

这里面有点绕来绕去的，不过多看几遍还是能看明白的。

这样，我们就在 Rust 中实现了类似 Tapable 的功能，不过目前只演示了最简单的 SyncHook 的用法，后面遇到其他钩子时再介绍吧。

接下来，我们就基于这个来实现插件系统。我们知道，实现一个 webpack 的插件一般是这样的做法：

```js
const pluginName = 'ConsoleLogOnBuildWebpackPlugin'

class ConsoleLogOnBuildWebpackPlugin {
  apply(compiler) {
    compiler.hooks.run.tap(pluginName, (compilation) => {
      console.log('The webpack build process is starting!')
    })
  }
}

module.exports = ConsoleLogOnBuildWebpackPlugin
```

我们也依样画葫芦，先来定义一个 `Plugin` 的 trait 来规定插件应具备的特性：

```rs
#[async_trait::async_trait]
pub trait Plugin: std::fmt::Debug {
    fn name(&self) -> &'static str {
        "unknown"
    }

    fn apply(&self, _ctx: PluginContext<&mut ApplyContext>) -> Result<()> {
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct PluginContext<T = ()> {
    pub context: T,
}

#[derive(Debug)]
pub struct ApplyContext<'c> {
    pub compiler_hooks: &'c mut CompilerHooks,
}

define_hook!(BeforeRun: SyncSeries(compiler: &mut Compiler));

#[derive(Default, Debug)]
pub struct CompilerHooks {
    pub before_run: BeforeRunHook,
}

```

可以看到，我们会把 `before_run` 这个钩子作为 context 创给 Plugin。

然后，我们来定义一个 `PluginDriver` 来驱动 `Plugin`：

```rs
pub struct PluginDriver {
    pub plugins: Vec<Box<dyn Plugin>>,
    pub compiler_hooks: CompilerHooks,
}

impl PluginDriver {
    pub fn new(plugins: Vec<Box<dyn Plugin>>) -> Arc<Self> {
        let mut compiler_hooks = CompilerHooks::default();
        let mut apply_context = ApplyContext {
            compiler_hooks: &mut compiler_hooks,
        };

        for plugin in &plugins {
            plugin
                .apply(PluginContext::with_context(&mut apply_context))
                .expect("failed to apply plugin context");
        }

        Arc::new(Self {
            plugins,
            compiler_hooks,
        })
    }
}
```

这里初始化了传入每个 `Plugin` 的参数，然后遍历这些 `Plugin` 并调用他们的 `apply` 方法。

`PluginDriver` 最后会在 `Compiler` 中进行使用：

```rs
impl Compiler {
    pub fn new(mut config: Config, plugins: Vec<BoxPlugin>) -> Compiler {
        let plugin_driver = PluginDriver::new(plugins);

        Compiler {
            root: config.root.clone(),
            entry_id: "".to_string(),
            config,
            modules: HashMap::new(),
            assets: HashMap::new(),
            plugin_driver,
        }
    }
    ...
```

我们暂时修改一下 `Compiler` 的 `run`：

```rs
pub fn run(&mut self) {
    self.plugin_driver.clone().compiler_hooks.before_run.call(self);
    // let resolved_entry = Path::new(&self.root).join(&self.config.entry);
    // self.build_module(resolved_entry, true);
    // self.emit_file();
}
```

然后，写个 Demo 测试一下：

```rust
use rswebpack_core::compiler::Compiler;
use rswebpack_core::config::{Config, Output};
use rswebpack_core::hooks::BeforeRun;
use rswebpack_core::plugin::{ApplyContext, Plugin, PluginContext};
use rswebpack_macros::{plugin, plugin_hook};
use rswebpack_error::Result;

#[plugin]
struct BeforeRunHookTap;

#[plugin_hook(BeforeRun for BeforeRunHookTap)]
fn before_run(&self, compiler: &mut Compiler) -> Result<()> {
    println!("Root is {}", compiler.root);
    Ok(())
}

#[derive(Debug)]
struct TestPlugin;

impl Plugin for TestPlugin {
    fn apply(&self, _ctx: PluginContext<&mut ApplyContext>) -> Result<()> {
        _ctx.context
            .compiler_hooks
            .before_run
            .tap(before_run::new(&BeforeRunHookTap::new_inner()));
        Ok(())
    }
}

fn main() {
    let config = Config::new(
        "test".to_string(),
        "test".to_string(),
        Output {
            path: "out".to_string(),
            filename: "bundle".to_string(),
        },
    );
    let compiler = &mut Compiler::new(config, vec![Box::new(TestPlugin {})]);
    compiler.run(); // Root is test
}
```

大功告成，不过实际开发中，自定义 `Plugin` 都是用 JS 开发的，怎么把这些 Plugin 集成进来呢，下篇再揭晓答案吧。
