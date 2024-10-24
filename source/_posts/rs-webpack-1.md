---
title: 从零实现 webpack，但 Rust 版 - [1] 使用 oxc 解析并修改 JS 代码
date: 2024-10-24 09:43:02
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
> 本文对应 [Pull Request](https://github.com/ParadeTo/rs-webpack/pull/1)

实现一个简单的 webpack，首要关键的任务是 JS 代码的解析问题，从头实现一个 JS 解析器是一个非常浩大的工程，所以我们还是挑选一个现成的工具吧，这里选择了 [oxc](https://oxc.rs/)，毕竟是尤大大背书过的。

虽然，oxc 没有 babel 那么详细的文档，但是使用套路还是类似，首先我们需要使用 oxc_parser 来解析 JS 代码生成 AST：

```rs
let name = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
let path = Path::new(&name);
let source_text = Arc::new(std::fs::read_to_string(path)?);
let source_type = SourceType::from_path(path).unwrap();

// Memory arena where Semantic and Parser allocate objects
let allocator = Allocator::default();

// 1 Parse the source text into an AST
let parser_ret = Parser::new(&allocator, &source_text, source_type).parse();
let mut program = parser_ret.program;

println!("Parse result");
println!("{}", serde_json::to_string_pretty(&program).unwrap());
```

其中 `test.js` 中的内容如下所示：

```js
const b = require('./b.js')
```

解析得到的 AST 如下所示：

```json
{
  "type": "Program",
  "start": 0,
  "end": 28,
  "sourceType": {
    "language": "javascript",
    "moduleKind": "module",
    "variant": "jsx"
  },
  "hashbang": null,
  "directives": [],
  "body": [
    {
      "type": "VariableDeclaration",
      "start": 0,
      "end": 27,
      "kind": "const",
      "declarations": [
        {
          "type": "VariableDeclarator",
          "start": 6,
          "end": 27,
          "id": {
            "type": "Identifier",
            "start": 6,
            "end": 7,
            "name": "b",
            "typeAnnotation": null,
            "optional": false
          },
          "init": {
            "type": "CallExpression",
            "start": 10,
            "end": 27,
            "callee": {
              "type": "Identifier",
              "start": 10,
              "end": 17,
              "name": "require"
            },
            "typeParameters": null,
            "arguments": [
              {
                "type": "StringLiteral",
                "start": 18,
                "end": 26,
                "value": "./b.js"
              }
            ],
            "optional": false
          },
          "definite": false
        }
      ],
      "declare": false
    }
  ]
}
```

熟悉 webpack 的知道，打包时我们需要把 `require` 替换成 `__webpack_require__`，并把相对路径 `./b.js` 替换成完整路径，所以我们还需要修改原来的代码，这就需要用到 oxc_traverse 了，它的作用是遍历 AST 中的节点，方便我们对感兴趣的节点进行操作。

从上面的 AST 结果中，可以看到我们感兴趣的节点是 `CallExpression`，所以我们可以实现一个 Transform 来修改这个节点，如下所示：

```rs
struct MyTransform;

impl<'a> Traverse<'a> for MyTransform {
    fn enter_call_expression(&mut self, node: &mut CallExpression<'a>, ctx: &mut TraverseCtx<'a>) {
        if node.is_require_call() {
            match &mut node.callee {
                Expression::Identifier(identifier_reference) => {
                    identifier_reference.name = Atom::from("__webpack_require__")
                }
                _ => {}
            }

            let argument: &mut Argument<'a> = &mut node.arguments.deref_mut()[0];
            match argument {
                Argument::StringLiteral(string_literal) => {
                    string_literal.value = Atom::from("full_path_of_b")
                }
                _ => {}
            }
        }
    }
}
```

可以按照如下方式来使用这个 Transform：

```rs
// 2 Semantic Analyze
let semantic = SemanticBuilder::new(&source_text)
    .build_module_record(path, &program)
    // Enable additional syntax checks not performed by the parser
    .with_check_syntax_error(true)
    .build(&program);
let (symbols, scopes) = semantic.semantic.into_symbol_table_and_scope_tree();

// 3 Transform
let t = &mut MyTransform;
traverse_mut(t, &allocator, &mut program, symbols, scopes);
```

注意，同 babel 不同的是，这里需要先使用 oxc_semantic 进行语法分析得到 `symbols` 和 `scopes` 一并传入 `traverse_mut`。

最后，我们使用 oxc_codegen 重新生成代码就大功告成了：

```rs
// 4 Generate Code
let new_code = CodeGenerator::new()
    .with_options(CodegenOptions {
        ..CodegenOptions::default()
    })
    .build(&program)
    .code;

println!("{}", new_code);
```

```js
const b = __webpack_require__('full_path_of_b')
```
