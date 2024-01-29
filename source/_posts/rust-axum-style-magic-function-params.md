---
title: 译：揭秘神奇的 Rust Axum 风格的函数实现（Rusts Axum style magic function params example）
date: 2024-01-29 11:02:12
tags:
  - rust
  - axum
categories:
  - rust
description: 揭秘神奇的 Rust Axum 风格的函数实现
---

在学习 Rust 时，我了解到它是一种严格的、静态类型的语言。尤其是它没有函数重载或可选参数这种特性。但是，当我看到 [Axum](https://github.com/tokio-rs/axum) 时，我惊讶地发现了这种代码：

```rust
let app = Router::new()
  .route("/users", get(get_users))
  .route("/products", get(get_product));

async fn get_users(Query(params): Query<Params>) -> impl IntoResponse {
    let users = /* ... */

    Json(users)
}

async fn get_product(State(db): State<Db>, Json(payload): Json<Payload>) -> String {
  let product = /* ... */

  product.to_string()
}
```

`get` 方法可以接收一个各种类型的函数作为参数！这是什么黑魔法？

为了搞清楚，我写了一个简单的例子：

```rust
fn print_id(id: Id) {
    println!("id is {}", id.0);
}

// Param(param) is just pattern matching
fn print_all(Param(param): Param, Id(id): Id) {
    println!("param is {param}, id is {id}");
}

pub fn main() {
    let context = Context::new("magic".into(), 33);

    trigger(context.clone(), print_id);
    trigger(context.clone(), print_all);
}
```

例子中，有一个 `trigger`，它接收一个 `Context` 和一个函数作为参数。作为参数的函数可以接收 1 个或 2 个参数，参数类型为 `Id` 或 `Param` 类型。神奇吗？

让我们来看看到底是怎么实现的，首先是 `Context`：

```rust
struct Context {
    param: String,
    id: u32,
}
```

`Context` 可以类比为 Axum 里的 `Request`，它是 `print_id` 和 `print_all` 函数里面数据的来源，这个例子中它仅包括两个字段。

接下来是第一个秘诀， `FromContext` trait：

```rust
trait FromContext {
    fn from_context(context: &Context) -> Self;
}
```

它使得我们可以创建各种 “Extractors” 来提取里面的内容，比如 `Param` 会提取里面的 `param` 字段：

```rust
struct Param(String);

impl FromContext for Param {
    fn from_context(context: &Context) -> Self {
        Param(context.param.clone())
    }
}
```

第二个秘诀是 `Handler` trait：

```rust
trait Handler<T> {
    fn call(self, context: Context);
}
```

我们会为 `Fn<T>` 类型来实现这个 trait：

```rust
impl<F, T> Handler<T> for F
where
    F: Fn(T),
    T: FromContext,
{
    fn call(self, context: Context) {
        self(T::from_context(&context));
    }
}
```

这样的话，我们在函数调用和它的参数之间就有了一个 “middleware”。这里我们将调用 `FromContext::from_context` 方法，将上下文转换为预期的函数参数，即 `Param` 或 `Id`。

译者注：执行 `impl<F, T> Handler<T> for F` 后，相当于为 `Fn<T>` 类型实现了 `Handler` 这个 trait，即 `print_id` 实现了 `Handler`，可以调用 `call` 方法，而 `call` 方法中的 `self` 就是 `print_id`。

我们继续添加代码，支持两个函数参数的情况。有趣的是，这个实现与参数的顺序无关--它同时支持 `fn foo(p: Param, id: id)` 和 `fn foo(id: id, p: Param)`：

```rust
impl<T1, T2, F> Handler<(T1, T2)> for F
where
    F: Fn(T1, T2),
    T1: FromContext,
    T2: FromContext,
{
    fn call(self, context: Context) {
        (self)(T1::from_context(&context), T2::from_context(&context));
    }
}
```

译者注：通过宏，可以一次性实现不定参数的情况，例：

```rust
macro_rules! all_the_tuples {
    ($name:ident) => {
        $name!([]);
        $name!([T1]);
        $name!([T1, T2]);
        $name!([T1, T2, T3]);
        // Can add more
    };
}

macro_rules! impl_handler {
    (
        [$($ty:ident),*]
    ) => {
        impl<F, $($ty,)*> Handler<($($ty,)*)> for F
        where
            F: Fn($($ty,)*),
            $( $ty: FromContext,)*
        {
            fn call(self, context: Context) {
                self($( $ty::from_context(&context), )*);
            }
        }
    };
}

all_the_tuples!(impl_handler);
```

最后实现 `trigger` 函数就搞定了：

```rust
fn trigger<T, H>(context: Context, handler: H)
where
    H: Handler<T>,
{
    handler.call(context);
}
```

现在，让我解释下下面代码：

```rust
let context = Context::new("magic".into(), 33);

trigger(context.clone(), print_id);
```

`print_id` 是 `Fn(Id)` 类型，它实现了 `Handler<Id>`，当调用 `handler.call` 方法时，相当于执行如下代码：

```rust
print_id(Id::from_context(&context));
```

魔术揭秘！

附完整代码：

```rust
#[derive(Clone, Debug)]
struct Context {
    param: String,
    id: u32,
}

impl Context {
    fn new(param: String, id: u32) -> Context {
        Context { param, id }
    }
}

trait FromContext {
    fn from_context(context: &Context) -> Self;
}
trait Handler<T> {
    fn call(self, context: Context);
}

struct Param(String);

impl FromContext for Param {
    fn from_context(context: &Context) -> Self {
        Param(context.param.clone())
    }
}

struct Id(u32);

impl FromContext for Id {
    fn from_context(context: &Context) -> Self {
        Id(context.id.clone())
    }
}

macro_rules! all_the_tuples {
    ($name:ident) => {
        $name!([]);
        $name!([T1]);
        $name!([T1, T2]);
        $name!([T1, T2, T3]);
    };
}

macro_rules! impl_handler {
    (
        [$($ty:ident),*]
    ) => {
        impl<F, $($ty,)*> Handler<($($ty,)*)> for F
        where
            F: Fn($($ty,)*),
            $( $ty: FromContext,)*
        {
            fn call(self, context: Context) {
                self($( $ty::from_context(&context), )*);
            }
        }
    };
}

all_the_tuples!(impl_handler);

fn trigger<T, H>(context: Context, handler: H)
where
    H: Handler<T>,
{
    handler.call(context);
}

fn print_id(id: Id) {
    println!("id is {}", id.0);
}

fn print_param(Param(param): Param) {
    println!("id is {}", param);
}

fn print_all(Param(param): Param, Id(id): Id) {
    println!("param is {param}, id is {id}");
}

pub fn main() {
    let context = Context::new("magic".into(), 33);
    trigger(context.clone(), print_id);
    trigger(context.clone(), print_param);
    trigger(context.clone(), print_all);
}
```
