---
title: 从零实现 React v18，但 WASM 版 - [14] 实现 Scheduler
date: 2024-05-16 19:45:40
tags:
  - wasm
  - react
categories:
  - rust
---

> 模仿 [big-react](https://github.com/BetaSu/big-react)，使用 Rust 和 WebAssembly，从零实现 React v18 的核心功能。深入理解 React 源码的同时，还锻炼了 Rust 的技能，简直赢麻了！
>
> 代码地址：https://github.com/ParadeTo/big-react-wasm
>
> 本文对应 tag：[v14](https://github.com/ParadeTo/big-react-wasm/tree/v14)

> Based on [big-react](https://github.com/BetaSu/big-react)，I am going to implement React v18 core features from scratch using WASM and Rust.
>
> Code Repository：https://github.com/ParadeTo/big-react-wasm
>
> The tag related to this article：[v14](https://github.com/ParadeTo/big-react-wasm/tree/v14)

# Scheduler 简介

# Introduction to Scheduler

`Scheduler` 是 React 中负责任务调度的一个包，它是实现时间分片的基础，后续要实现的 `useEffect` 也用到了它，所以这篇文章我们先来实现 WASM 版本的 `Scheduler`。

`Scheduler` is a package in React responsible for task scheduling, and it lays the groundwork for implementing time slicing. The upcoming `useEffect` will also utilize it, so in this article, we'll start by implementing a WASM (WebAssembly) version of the `Scheduler`.

关于 `Scheduler` 的介绍可以查看之前写的[这篇文章](/2020/12/30/react-concurrent-1/)，下面简单介绍下他的实现。

For an introduction to `Scheduler`, you can refer to [this article](/2020/12/30/react-concurrent-1/) I wrote previously. Below is a brief introduction to its implementation.

`Scheduler` 中维护有两个小顶堆 `timerQueue` 和 `taskQueue`，其中已经就绪的 task（`startTime` <= `currentTime`）会被放入 `taskQueue` 堆中，未就绪的 task（通过传入 `delay` 使得 `startTime` > `currentTime` ）会被放入 `timeQueue`。比如下面这个例子，`task1` 会被放入 `taskQueue`，`task2` 会被放入 `timerQueue`。

`Scheduler` maintains two min-heaps: `timerQueue` and `taskQueue`. Tasks that are ready (`startTime` <= `currentTime`) are placed into the `taskQueue`, while tasks that are not yet ready (with `startTime` > `currentTime` achieved by passing in a `delay`) are placed into the `timerQueue`. For instance, in the example below, `task1` would be placed into the `taskQueue`, while `task2` would be placed into the `timerQueue`.

```js
const task1 = Scheduler.unstable_scheduleCallback(2, function func1() {
  console.log('2')
})

const task2 = Scheduler.unstable_scheduleCallback(
  1,
  function func2() {
    console.log('1')
  },
  {delay: 100}
)
```

之后通过 `MessageChannel` 开启一个宏任务来处理 `taskQueue` 中的任务，当处理时间超过 5ms 时会中断，然后开启一个新的宏任务来继续处理剩下的任务，如此循环直到堆中任务完成。而 `timerQueue` 中的任务会定时检查是否已经就绪，如果就绪，就依次弹出放入 `taskQueue` 中。

Later on, a macro task is initiated through `MessageChannel` to process the tasks in the `taskQueue`. If the processing time exceeds 5ms, it will be interrupted, and then a new macro task will be started to continue processing the remaining tasks. This cycle repeats until all tasks in the heap are completed. Tasks in the `timerQueue` are periodically checked to see if they are ready. If they are, they are popped out in sequence and placed into the `taskQueue`.

本次修改详见[这里](https://github.com/ParadeTo/big-react-wasm/pull/13/files)，下面挑一些重点解释下。

The details of this update can be seen [here](https://github.com/ParadeTo/big-react-wasm/pull/13/files). Below, I will highlight and explain some key points.

# 小顶堆的实现

# Implementation of Min Heap

为了方便编写单元测试，实现了一个泛型版本的小顶堆：

To facilitate writing unit tests, a generic version of the min heap was implemented:

```rust
...
pub fn push<T: Ord>(heap: &mut Vec<T>, value: T) {
    heap.push(value);
    sift_up(heap, heap.len() - 1);
}
...
fn sift_up<T: Ord>(heap: &mut Vec<T>, mut index: usize) {
    while index != 0 {
        let parent = (index - 1) / 2;
        if heap[parent] <= heap[index] {
            break;
        }
        heap.swap(parent, index);
        index = parent;
    }
}
...
```

不过这个泛型 `T` 被 `Ord` 所约束，需要实现 `Ord` trait, 比如像这样：

However, this generic `T` is constrained by `Ord`, requiring the implementation of the `Ord` trait, like this:

```rust
struct Task {
    id: u32
}

impl Eq for Task {}

impl PartialEq for Task {
    fn eq(&self, other: &Self) -> bool {
        self.id.cmp(&other.id) == Ordering::Equal
    }
}

impl PartialOrd for Task {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        return self.id.partial_cmp(&other.id);
    }
}

impl Ord for Task {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}
```

# static mut

`Scheduler` 的实现中定义了大量的 `static mut`，导致代码中出现了很多 unsafe 代码块。很显然不是一个好的做法，但是这么做的好处是实现方式跟 React 的比较像，方便抄代码，此外更重要的一个原因是如果不使用 `static mut`，而是定义一个 `Scheduler` struct，把这些 `static mut` 作为其属性，会遇到别的问题。

The implementation of `Scheduler` defines a large number of `static mut`, leading to many unsafe code blocks in the code. Clearly, this is not a good practice, but the advantage of doing so is that the implementation is more similar to React's, which facilitates copying code. Moreover, another more important reason is that if we do not use `static mut`, but instead define a `Scheduler` struct and make these `static mut` as its attributes, other problems will be encountered.

比如当把 `perform_work_until_deadline` 作为宏任务的回调函数时，需要改为 `self.perform_work_until_deadline`，而这样编译是通不过的：

For instance, when using `perform_work_until_deadline` as the callback function for a macro task, it would need to be changed to `self.perform_work_until_deadline`, and such a change would not compile:

```rust
pub fn schedule_perform_work_until_deadline() {
    let perform_work_closure =
        // Will fail to compile if it is changed to self.perform_work_until_deadline
        Closure::wrap(Box::new(perform_work_until_deadline) as Box<dyn FnMut()>);
```

即使改成闭包也是不行的：

Even changing it to a closure would not work:

```rust
pub fn schedule_perform_work_until_deadline() {
    let perform_work_closure =
        Closure::wrap(Box::new(|| self.perform_work_until_deadline()) as Box<dyn FnMut()>);
```

所以目前来看是不得已为止，而使用 unsafe 绕过 Rust 的安全检查后，会有一些奇怪的行为，比如下面这个例子：

Therefore, it seems to be a necessary evil for the time being. However, by using unsafe to bypass Rust's safety checks, some strange behaviors can occur, such as the following example:

```rust
static mut MY_V: Vec<Task> = vec![];

#[derive(Debug)]
struct Task {
    name: String
}

fn peek<'a>(v: &'a mut Vec<Task>) -> &'a Task {
    &v[0]
}

fn pop<'a>(v: &'a mut Vec<Task>) -> Task {
    let t = v.swap_remove(0);
    t
}

fn main() {
    unsafe {
        MY_V = vec![Task {
            name: "ayou".to_string()
        }];

        let t = peek(&mut MY_V);

        // 1
        // pop(&mut MY_V);
        // 2
        let a = pop(&mut MY_V);

        println!("{:?}", t.name);
    };
}
```

代码 1 和 2，最后的输出竟然是不一样的，代码 1 输出 `"\0\0\0\0"`，而代码 2 输出正常，而他们的区别只在于返回的值是否赋值给了一个变量。

Code 1 and Code 2 produce different outputs. Code 1 outputs `"\0\0\0\0"`, while Code 2 outputs normally, and the only difference between them is whether the return value is assigned to a variable or not.

至于为什么会有这样的差异暂时还没有搞得很清楚，好在测试发现目前没有别的问题了，接下来可以实现 `useEffect` 了。

As to why there is such a difference, it's not yet very clear. Fortunately, testing has revealed that there are no other issues for now, and next, we can proceed to implement `useEffect`.
