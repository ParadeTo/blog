---
title: 设计模式之单例模式（TypeScript & Rust）
date: 2024-03-08 14:10:42
tags:
  - Design Pattern
categories:
  - rust
---

单例模式在软件开发中有很多应用场景，比如数据库连接池、全局唯一的对话框、全局日志记录等。

The singleton pattern has many applications in software development, such as a database connection pool, a globally unique dialog, a global logging tool, and more.

# TypeScript

```ts
class Singleton {
  private static instance: Singleton
  private data: string

  private constructor(data: string) {
    this.data = data
  }

  public static getInstance(data: string): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton(data)
    }
    return Singleton.instance
  }

  public getData(): string {
    return this.data
  }
}

const instance1 = Singleton.getInstance('hello')
const instance2 = Singleton.getInstance('world')

console.log(instance1 === instance2) // true
console.log(instance1.getData()) // hello
console.log(instance2.getData()) // hello
```

TypeScript 实现方式如上，比较简单，接下来看 Rust 怎么实现。

The implementation in TypeScript is as mentioned above, relatively simple. Now let's see how to implement it in Rust.

# Rust

学习 Rust 一天后，写出下面这个版本应该很简单：

After learning Rust for a day, it should be very easy to write the following code:

```rust
pub struct Singleton {}

static INSTANCE: &Singleton = &Singleton {};

pub fn get_instance() -> &'static Singleton {
    INSTANCE
}

let instance1 = get_instance();
let instance2 = get_instance();
println!("{:p} {:p}", instance1, instance2);
```

不过上面的代码明显不能用，`Singleton` 根本没有任何参数。那我们来修改一下，给 `Singleton` 加个参数：

However, the code above is obvious invalid, as the `Singleton` struct does not have any parameter. Let's modify it by adding a parameter to `Singleton`:

```rust
pub struct Singleton {
    data: String,
}

static mut INSTANCE: &mut Singleton = &mut Singleton {
    data: "".to_string(),
};

pub fn get_instance() -> &'static mut Singleton {
    unsafe { INSTANCE }
}
```

结果确发现报错了：

However, it failed to compile:

```
   |
40 |     data: "".to_string(),
   |              ^^^^^^^^^^^
   |
   = note: calls in statics are limited to constant functions, tuple structs and tuple variants
   = note: consider wrapping this expression in `Lazy::new(|| ...)` from the `once_cell` crate: https://crates.io/crates/once_cell
```

那就按照它的提示使用 `once_cell` 这个库再试一下，同时加个 `init` 方法给外部初始化数据用：

So let's follow its prompt and try using the `once_cell` library, and add an `init` method for external data initialization.

```rust

#[derive(Default)]
pub struct Singleton {
    data: String,
}

impl Singleton {
    pub fn init(&mut self, data: String) {
        self.data = data
    }

    pub fn get_data(&self) -> &str {
        self.data.as_str()
    }
}

static mut INSTANCE: Lazy<Singleton> = Lazy::new(|| Singleton::default());

pub fn get_instance() -> &'static mut Singleton {
    unsafe { INSTANCE.deref_mut() }
}

let mut instance1 = get_instance();
let mut instance2 = get_instance();
instance1.init("hello".to_string());
instance2.init("world".to_string());
let d1 = instance1.get_data();
let d2 = instance2.get_data();
println!("{} {}", d1, d2); // world world
```

编译通过了，不过这个明显不符合要求，因为最后 `data` 的值是取最后调用 `init` 方法所传的参数 `world`。继续看 `once_cell` 的文档，发现它提供了 `set` 和 `get` 方法，那就可以用来存储和访问 `SingleTon` 的实例，且实例化的代码可以挪到 `get_instance` 中去了：

The compilation passed, but it clearly does not meet the requirements because the value of data is set to the parameter passed to by the last calling of `init` method, which is 'world'. Continuing to look at the documentation for `once_cell`, I found that it provides `set` and `get` methods, which can be used to store and access the instance of `Singleton`, and the instantiation code can be moved to the `get_instance` method:

```rust
use once_cell::sync::{OnceCell};

#[derive(Default, Debug)]
pub struct Singleton {
    data: String,
}

impl Singleton {
    pub fn new(data: String) -> Self {
        Self { data }
    }

    pub fn get_data(&self) -> &str {
        self.data.as_str()
    }
}

static INSTANCE: OnceCell<Singleton> = OnceCell::new();
pub fn get_instance(data: String) -> &'static Singleton {
    unsafe {
        if (INSTANCE.get().is_none()) {
            let mut instance = Singleton::new(data);
            INSTANCE.set(instance).expect("Failed to set");
        }

        &INSTANCE.get().unwrap()
    }
}

let mut instance1 = get_instance();
let mut instance2 = get_instance();
instance1.init("hello".to_string());
instance2.init("world".to_string());
let d1 = instance1.get_data();
let d2 = instance2.get_data();
println!("{} {}", d1, d2); // hello hello
```

似乎又成了，不过别高兴的太早，如果换成如下测试代码，就有问题了：

It seems to work again, but don't get too excited. If we switch to the following test code, there will be a problem:

```rust
    let threads: Vec<_> = (0..10)
        .map(|i| {
            spawn(move || {
                get_instance(format!("hello{}", i));
            })
        })
        .collect();

    for handle in threads {
        handle.join().unwrap();
    }

    let instance = get_instance("".to_string());
    println!("{}", instance.get_data());
```

```
Failed to set: Singleton { data: "hello0" }Failed to set: Singleton { data: "hello1" }
```

原因在于 `INSTANCE.get().is_none()` 这条语句不是线程安全的，多个线程可能都能进入 if 的代码块：

The reason is that the statement `INSTANCE.get().is_none()` is not thread-safe. Multiple threads may enter the code block inside the if statement:

```rust
if (INSTANCE.get().is_none()) {

}
```

那我们来加个锁吧：

Let's add a lock then:

```rust
static mut INITIALIZED: Mutex<bool> = Mutex::new(false);
static INSTANCE: OnceCell<Singleton> = OnceCell::new();
pub fn get_instance(data: String) -> &'static Singleton {
    unsafe {
        let mut a = INITIALIZED.lock().unwrap();
        if (!*a) {
            let instance = Singleton::new(data);
            INSTANCE.set(instance).expect("Failed to set");
            *a = true;
        }

        &INSTANCE.get().unwrap()
    }
}
```

又可以正常工作了。并且，还可以使用 `std::sync::Once` ，让我们的代码更简单：

Now it can work properly again. Moreover, we can use `std::sync::Once` to make our code simpler:

```rust
static INIT: Once = Once::new();
static INSTANCE: OnceCell<Singleton> = OnceCell::new();

pub fn get_instance(data: String) -> &'static Singleton {
    INIT.call_once(|| {
        let instance = Singleton::new(data);
        INSTANCE.set(instance).expect("Fail to set");
    });

    INSTANCE.get().unwrap()
}

```

没问题了？No！某些场景下，我需要让 `Singleton` 实例是线程互斥的，比如有如下需求：

It's OK now? No! In certain scenarios, I need the `Singleton` instance to be thread-exclusive. For example, consider the following requirements:

```rust
pub fn log(&self, thread_name: String) {
    println!("{}: step1", thread_name);
    println!("{}: step2", thread_name);
}
```

当我在某个线程下调用 `log` 方法时，必须要连续打印完 `step1` 和 `step2` 才能打印别的线程的日志，此时上述的代码就不能支持了。此时，需要给整个 `Singleton` 实例加锁：

When I invoke the `log` method in a particular thread, it is necessary to print `step1` and `step2` consecutively before printing logs from other threads. In this case, the aforementioned code cannot support this requirement. Therefore, it is necessary to lock the entire `Singleton` instance:

```rust
static INSTANCE: OnceCell<Mutex<Singleton>> = OnceCell::new();

pub fn get_instance(data: String) -> MutexGuard<'static, Singleton> {
    INIT.call_once(|| {
        let instance = Mutex::new(Singleton::new(data));
        INSTANCE.set(instance).expect("Fail to set instance");
    });

    INSTANCE.get().unwrap().lock().unwrap()
}

```

这样一个支持多线程的单例就实现了，完整代码如下：

With this implementation, a multi-threaded singleton is achieved. The complete code is as follows:

```rust
// singleton.rs
use once_cell::sync::OnceCell;
use std::sync::{Mutex, MutexGuard, Once};

#[derive(Debug)]
pub struct Singleton {
    data: String,
}

impl Singleton {
    fn new(data: String) -> Self {
        Self { data }
    }

    pub fn get_data(&self) -> &str {
        &self.data
    }
    pub fn log(&self, thread_name: String) {
        println!("{}: step1", thread_name);
        println!("{}: step2", thread_name);
    }
}

static INIT: Once = Once::new();
static INSTANCE: OnceCell<Mutex<Singleton>> = OnceCell::new();

pub fn get_instance(data: String) -> MutexGuard<'static, Singleton> {
    INIT.call_once(|| {
        let instance = Mutex::new(Singleton::new(data));
        INSTANCE.set(instance).expect("Fail to set instance");
    });

    INSTANCE.get().unwrap().lock().unwrap()
}

// main.rs
let threads: Vec<_> = (0..10)
    .map(|i| {
        spawn(move || {
            let instance = get_instance(format!("hello{}", i));
            instance.log(format!("thread{}", i));
        })
    })
    .collect();

for handle in threads {
    handle.join().unwrap();
}

let instance = get_instance("".to_string());
println!("{}", instance.get_data());
```
