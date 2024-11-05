---
title: 从零实现 webpack，但 Rust 版 - [2] 实现 MVP 版本
date: 2024-10-28 14:57:17
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
> 本文对应 Pull Request：https://github.com/ParadeTo/rs-webpack/pull/2

前文已经介绍如何使用 oxc 来解析并修改 JS 代码，解决了最核心的问题，那现在已经可以实现一个 MVP 版本了，本次 MVP 目标是实现对下面这个代码的打包，并能正常运行输出的结果：

```js
// index.js
const b = require('./const.js')
console.log(b)

// const.js
module.exports = 'hello'
```

我们新建一个 `Compiler` 结构体，它包括如下属性和方法：

```rs
pub struct Compiler {
    config: Config,
    entry_id: String,
    root: String,
    modules: HashMap<String, String>,
    assets: HashMap<String, String>,
}

impl Compiler {
    pub fn new(config: Config) -> Compiler {

    }

    fn parse(
        &self,
        module_path: PathBuf,
        parent_path: &Path,
    ) -> (String, Rc<RefCell<Vec<String>>>) {
      // Get module's code and dependencies
    }

    fn build_module(&mut self, module_path: PathBuf, is_entry: bool) {
      // Call build_module recursively the get modules (key is module_id, value is the code)
    }

    fn emit_file(&mut self) {
      // Output result
    }

    pub fn run(&mut self) {
      // The entry
    }
}
```

其中，`run` 是入口，它会调用 `build_module`，`build_module` 首先会调用 `parse` 得到 JS 模块的代码和它的依赖进行返回（顺便还会对原来的代码进行转换），然后 `build_module` 中会递归调用自己继续对这些依赖进行处理，最终得到 `modules`。`modules` 是一个 `HashMap`，其中 key 为模块 id，即模块相对于 root 的路径，value 则是转换后的模块代码。`run` 最后会调用 `emit_file` 输出结果。完整代码请见 [Pull Request](https://github.com/ParadeTo/rs-webpack/pull/2)，下面挑几个重点讲一下。

## Tranform

前文曾给出了一个 Transform 的例子，用于解释如何修改 `require` 的参数，例子中我们是把参数改成了固定的 `full_path_of_b`：

```rs
string_literal.value = Atom::from("full_path_of_b")
```

但是，实际开发的时候，这里的参数是跟当前 JS 模块的路径有关的，是动态的。我们可以用下面这个例子来说明（给 `require` 的参数增加一个动态的 `prefix`）：

```rs
struct MyTransform {
    prefix: String,
}

impl<'a> Traverse<'a> for MyTransform {
    fn enter_call_expression(&mut self, node: &mut CallExpression<'a>, ctx: &mut TraverseCtx<'a>) {
        if node.is_require_call() {
            let argument: &mut Argument<'a> = &mut node.arguments.deref_mut()[0];
            match argument {
                Argument::StringLiteral(string_literal) => {
                    let old_name = string_literal.value.as_str();
                    let new_name = format!("{}{}", self.prefix, old_name);

                    // !!!!!! `new_name` does not live long enough
                    string_literal.value = Atom::from(new_name.as_str());
                }
                _ => {}
            }
        }
    }
}
```

上面的代码编译不通过，会报错 `new_name does not live long enough`，因为 `new_name` 会在函数执行完后销毁，但是 `Atom::from` 声明了一个生命周期 `'a`。解决办法是这样：

```rs
string_literal.value = ctx.ast.atom(new_name.as_str());
```

原因可以通过 `ctx.ast.atom` 的源码来解释：

```rs
#[inline]
pub fn atom(self, value: &str) -> Atom<'a> {
    Atom::from(String::from_str_in(value, self.allocator).into_bump_str())
}
```

可以看到，`atom` 方法没有声明生命周期，最终还是调用了 `Atom::from`，但是里面的值是通过 `String::from_str_in` 生成的，其中第二个参数 `self.allocator` 是带生命周期的：

```rs
pub struct AstBuilder<'a> {
    pub allocator: &'a Allocator,
}
```

而 `Allocator` 则是基于 [bumpalo](https://github.com/fitzgen/bumpalo) 实现的内存分配的工具，`Allocator` 这个东西好像在实现解析器一般都要用到，可以参考这个[教程](https://rust-hosted-langs.github.io/book/chapter-alignment.html)，对这块还不太了解，先略过了。

## Emit File

输出最终的打包文件时，用到了模板引擎 [sailfish](https://github.com/rust-sailfish/sailfish)，模版如下所示：

```ejs
(function(modules) {
    var installedModules = {};
    ...

    // Load entry module and return exports
    return __webpack_require__(__webpack_require__.s = "<%- entry_id %>");
})
({
   <% for (key, value) in modules { %>
     "<%- key %>":
     (function(module, exports, __webpack_require__) {
       eval(`<%- value %>`);
     }),
   <%}%>
});
```

可以看到，只需要将 `entry_id` 和 `modules` 的内容输出到模版中即可。

运行 `cargo run`，得到输出结果：

```js
// out/bundle.js
(function(modules) {
    var installedModules = {};
    ...
    // Load entry module and return exports
    return __webpack_require__(__webpack_require__.s = "./index.js");
})
({

     "./const.js":
     (function(module, exports, __webpack_require__) {
       eval(`module.exports = "hello";
`);
     }),

     "./index.js":
     (function(module, exports, __webpack_require__) {
       eval(`const b = __webpack_require__("./const.js");
console.log(b);
`);
     }),

});
```

使用 Node.js 运行，如果可以正常打印 `hello`，则表示 MVP 成功完成。
