---
title: 如何在 Go 中使用接口（译）
date: 2018-01-24 23:45:01
tags:
- go
categories:
- 翻译
description: 关于 Go 中接口的一篇好文章
---


> 本文翻译自 [How to use interfaces in Go](http://jordanorelli.com/post/32665860244/how-to-use-interfaces-in-go) 有部分删减，请以原文为准


在开始使用 Go 编程之前，我的大部分工作都是用 Python 完成的。作为一名 Python 程序员，我发现学习使用 Go 中的接口是非常困难的。基础很简单，而且我知道如何在标准库中使用接口，但是我做了很多练习之后才知道如何设计自己的接口。在本文中，我将讨论 Go 的类型系统，以解释如何有效地使用接口。

### 接口介绍

接口是什么？一个接口包含两层意思：它是一个方法的集合，同样是一个类型。让我们首先关注接口作为方法的集合这一方面。

通常，我们会用一些假设的例子来介绍接口。让我们来看看这个例子： `Animal` 类型是一个接口，我们将定义一个 `Animal` 作为任何可以说话的东西。这是 Go 类型系统的核心概念：我们根据类型可以执行的操作而不是其所能容纳的数据类型来设计抽象。

```go
type Animal interface {
    Speak() string
}
```

非常简单：我们定义 `Animal` 为任何具有 `Speak` 方法的类型。`Speak` 方法没有参数，返回一个字符串。所有定义了该方法的类型我们称它**实现**了 `Animal` 接口。Go 中没有 `implements` 关键字，判断一个类型是否实现了一个接口是完全是自动地。让我们创建几个实现这个接口的类型：

```go
type Dog struct {
}

func (d Dog) Speak() string {
    return "Woof!"
}

type Cat struct {
}

func (c Cat) Speak() string {
    return "Meow!"
}

type Llama struct {
}

func (l Llama) Speak() string {
    return "?????"
}

type JavaProgrammer struct {
}

func (j JavaProgrammer) Speak() string {
    return "Design patterns!"
}
```


我们现在有四种不同类型的动物：`Dog`、`Cat`、`Llama` 和 `JavaProgrammer`。在我们的 `main` 函数中，我们创建了一个 `[]Animal{Dog{}, Cat{}, Llama{}, JavaProgrammer{}}` ，看看每只动物都说了些什么：

```go
func main() {
    animals := []Animal{Dog{}, Cat{}, Llama{}, JavaProgrammer{}}
    for _, animal := range animals {
        fmt.Println(animal.Speak())
    }
}
```

很好，现在你知道如何使用接口了，我不需要再讨论它们了，对吧？不是的。让我们来看看一些不太明显的东西。

### `interface{}` 类型


`interface{}` 类型，**空接口**，是导致很多混淆的根源。`interface{}` 类型是没有方法的接口。由于没有 `implements` 关键字，所以所有类型都至少实现了 0 个方法，所以 **所有类型都实现了空接口**。这意味着，如果您编写一个函数以 `interface{}` 值作为参数，那么您可以为该函数提供任何值。例如：

```go
func DoSomething(v interface{}) {
   // ...
}
```


这里是让人困惑的地方：在 `DoSomething` 函数内部，`v` 的类型是什么？新手们会认为 `v` 是**任意**类型的，但这是错误的。`v` 不是**任意**类型，它是 `interface{}` 类型。对的，没错！当将值传递给`DoSomething` 函数时，Go 运行时将执行类型转换(如果需要)，并将值转换为 `interface{}` 类型的值。所有值在运行时只有一个类型，而 `v` 的一个静态类型是 `interface{}` 。


这可能让您感到疑惑：好吧，如果发生了转换，到底是什么东西传入了函数作为 `interface{}` 的值呢？（具体到上例来说就是 `[]Animal` 中存的是啥？）

一个接口值由两个字（32 位机器一个字是 32 bits，64 位机器一个字是 64 bits）组成；一个字用于指向该值底层类型的方法表，另一个字用于指向实际数据。我不想没完没了地谈论这个。如果您理解一个接口值是两个字，并且它包含指向底层数据的指针，那么这就足以避免常见的陷阱。如果您想了解更多关于接口实现的知识。这篇文章很有用：[Russ Cox’s description of interfaces](https://t.umblr.com/redirect?z=http%3A%2F%2Fresearch.swtch.com%2Finterfaces&t=YTNhMjY1ZmM2NmJhMDcwYjAwNzY0MTYzYzBhMDA1MjRjZmIxZTYzMyxoZmZyTU04Sg%3D%3D&b=t%3AWvVgq8ST2uhqerqL8LopZw&p=http%3A%2F%2Fjordanorelli.com%2Fpost%2F32665860244%2Fhow-to-use-interfaces-in-go&m=1 "Russ Cox's description of interfaces") 。

在我们上面的例子中，当我们初始化变量 `animals` 时，我们不需要像这样 `Animal(Dog{})` 来显示的转型，因为这是自动地。这些元素都是 `Animal` 类型，但是他们的底层类型却不相同。

为什么这很重要呢？理解接口是如何在内存中表示的，可以使得一些潜在的令人困惑的事情变得非常清楚。比如，像 “我可以将 []T 转换为 []interface{}
 吗？” 这种问题就容易回答了。下面是一些烂代码的例子，它们代表了对 `interface{}` 类型的常见误解：

```go
package main

import (
    "fmt"
)

func PrintAll(vals []interface{}) {
    for _, val := range vals {
        fmt.Println(val)
    }
}

func main() {
    names := []string{"stanley", "david", "oscar"}
    PrintAll(names)
}
```

运行这段代码你会得到如下错误：`cannot use names (type []string) as type []interface {} in argument to PrintAll`。如果想使其正常工作，我们必须将 `[]string` 转为 `[]interface{}`：

```go
package main

import (
    "fmt"
)

func PrintAll(vals []interface{}) {
    for _, val := range vals {
        fmt.Println(val)
    }
}

func main() {
    names := []string{"stanley", "david", "oscar"}
    vals := make([]interface{}, len(names))
    for i, v := range names {
        vals[i] = v
    }
    PrintAll(vals)
}
```

很丑陋，但是**生活就是这样**，没有完美的事情。（事实上，这种情况不会经常发生，因为 `[]interface{}` 并没有像你想象的那样有用）

### 指针和接口


接口的另一个微妙之处是接口定义没有规定一个实现者是否应该使用一个指针接收器或一个值接收器来实现接口。当给定一个接口值时，不能保证底层类型是否为指针。在前面的示例中，我们将方法定义在值接收者之上。让我们稍微改变一下，将 `Cat` 的 `Speak()` 方法改为指针接收器：

```go
func (c *Cat) Speak() string {
    return "Meow!"
}
```

运行上述代码，会得到如下错误：

```
cannot use Cat literal (type Cat) as type Animal in array or slice literal:
	Cat does not implement Animal (Speak method has pointer receiver)
```


该错误的意思是：你尝试将 `Cat` 转为 `Animal` ，但是只有 `*Cat` 类型实现了该接口。你可以通过传入一个指针 （`new(Cat)` 或者 `&Cat{}`）来修复这个错误。

```
animals := []Animal{Dog{}, new(Cat), Llama{}, JavaProgrammer{}}
```


让我们做一些相反的事情：我们传入一个 `*Dog` 指针，但是不改变 `Dog` 的 `Speak()` 方法：

```
animals := []Animal{new(Dog), new(Cat), Llama{}, JavaProgrammer{}}
```

这种方式可以正常工作，因为一个指针类型可以通过其相关的值类型来访问值类型的方法，但是反过来不行。即，一个 `*Dog` 类型的值可以使用定义在 `Dog` 类型上的 `Speak()` 方法，而 `Cat` 类型的值不能访问定义在 `*Cat` 类型上的方法。

这可能听起来很神秘，但当你记住以下内容时就清楚了：Go 中的所有东西都是按值传递的。每次调用函数时，传入的数据都会被复制。对于具有值接收者的方法，在调用该方法时将复制该值。例如下面的方法：

```go
func (t T)MyMethod(s string) {
    // ...
}
```

是 `func(T, string)` 类型的方法。方法接收器像其他参数一样通过值传递给函数。

因为所有的参数都是通过值传递的，这就可以解释为什么 `*Cat` 的方法不能被 `Cat` 类型的值调用了。任何一个  `Cat` 类型的值可能会有很多 `*Cat` 类型的指针指向它，如果我们尝试通过 `Cat` 类型的值来调用 `*Cat` 的方法，根本就不知道对应的是哪个指针。相反，如果 `Dog` 类型上有一个方法，通过 `*Dog` 来调用这个方法可以确切的找到该指针对应的 `Gog` 类型的值，从而调用上面的方法。运行时，Go 会自动帮我们做这些，所以我们不需要像 C语言中那样使用类似如下的语句 `d->Speak()` 。


### 例1：通过 Twitter API 获取正确的时间戳

Twitter API 使用下面的格式来展示时间戳：

```
"Thu May 31 00:00:01 +0000 2012"
```

Twitter API 返回的是一个 json 字符串，这里我们只考虑解析 `created_at` 字段：

```go
package main

import (
    "encoding/json"
    "fmt"
    "reflect"
)

// start with a string representation of our JSON data
var input = `
{
    "created_at": "Thu May 31 00:00:01 +0000 2012"
}
`

func main() {
    // our target will be of type map[string]interface{}, which is a
    // pretty generic type that will give us a hashtable whose keys
    // are strings, and whose values are of type interface{}
    var val map[string]interface{}

    if err := json.Unmarshal([]byte(input), &val); err != nil {
        panic(err)
    }

    fmt.Println(val)
    for k, v := range val {
        fmt.Println(k, reflect.TypeOf(v))
    }
}
```

运行上述代码，输出：

```
map[created_at:Thu May 31 00:00:01 +0000 2012]
created_at Thu May 31 00:00:01 +0000 2012 string
```

我们得到了解析后的结果，但是解析出来的时间是字符串类型的，作用有限，因此我们想把它解析成 `time.Time` 类型的，对代码做出如下修改：

```
var val map[string]interface{} -> var val map[string]time.Time
```

结果出错了：

```
panic: parsing time ""Thu May 31 00:00:01 +0000 2012"" as ""2006-01-02T15:04:05Z07:00"": cannot parse "Thu May 31 00:00:01 +0000 2012"" as "2006"
```

出错的原因是字符串格式与 Go 中的时间格式不匹配（因为 Twitter's API 是用 Ruby 写的，其格式跟 Go 不同）。我们必须定义我们自己的类型来解析时间。`encoding/json` 在解析时会判断传入 `json.Unmarshal` 的值是否实现了 `json.Unmarshaler` 接口：

```go
type Unmarshaler interface {
    UnmarshalJSON([]byte) error
}
```

如果实现了，就会调用 `UnmarshalJSON` 方法来解析（[参考](https://golang.org/pkg/encoding/json/#Unmarshaler)），所以我们需要的是一个实现了 `UnmarshalJSON([]byte) error` 方法的类型：

```go
type Timestamp time.Time

func (t *Timestamp) UnmarshalJSON(b []byte) error {
    // ...
}
```

值得注意的是，我们使用一个指针作为方法接受者，因为我们希望在方法内对接受者进行更改。`UnmarshalJSON` 中，`t` 代表指向 `Timestamp` 类型值的指针，通过 `*t` 我们可以访问到这个值，这样就可以修改它了。

我们可以使用 `time.Parse(layout, value string) (Time, error)` 来解析时间，该函数的第一个参数是表示时间格式的字符串（[更多字符串格式](https://t.umblr.com/redirect?z=http%3A%2F%2Fgolang.org%2Fpkg%2Ftime%2F&t=MjBjODdjZjg0YzVhYTJjMTk1NjM0OTE0NGFhODY2Y2U1MmU3ZDIwOSxoZmZyTU04Sg%3D%3D&b=t%3AWvVgq8ST2uhqerqL8LopZw&p=http%3A%2F%2Fjordanorelli.com%2Fpost%2F32665860244%2Fhow-to-use-interfaces-in-go&m=1 "the time package")），第二个是我们要解析的字符串。返回 `time.Time` 类型的值以及 `error`（如果解析出错）。解析得到 `time.Time` 类型的值后，转换成 `Timestamp` 类型然后赋值给 `*t`：

```go
func (t *Timestamp) UnmarshalJSON(b []byte) error {
    v, err := time.Parse(time.RubyDate, string(b[1:len(b)-1]))
    if err != nil {
        return err
    }
    *t = Timestamp(v)
    return nil
}
```

注意，传入函数的 `[]byte` 是原始的 JSON 数据，其中包含有引号，所以这里需要切片去掉引号。

### 例2：从 HTTP 请求中得到对象

然我们设计一个接口来解决 web 开发中常见的一个问题：我们想解析 HTTP 请求体得到我们需要的对象数据。例如，我们这样定义我们的接口：

```go
GetEntity(*http.Request) (interface{}, error)
```

因为 `interface{}` 可以有任意的底层类型，所以我们可以解析得到任何我们需要的东西。但是这是一个不好的设计，我们将过多的逻辑引入到 `GetEntity` 函数中，`GetEntity` 函数现在需要针对每一种新类型进行修改，我们需要使用类型断言来处理返回的值。在实践中，返回 `interface{}` 的函数往往很烦人，作为一个经验法则，您只需要记住，将 `interface{}` 作为参数而不是返`interface{}` 值通常更好（[Postel’s Law](https://t.umblr.com/redirect?z=http%3A%2F%2Fen.wikipedia.org%2Fwiki%2FRobustness_Principle&t=ZGYxODRiYjhjOWQwNzA5MjgzYTA0ZjRjN2QxNzZiZmJhYzFkNGFjNyxoZmZyTU04Sg%3D%3D&b=t%3AWvVgq8ST2uhqerqL8LopZw&p=http%3A%2F%2Fjordanorelli.com%2Fpost%2F32665860244%2Fhow-to-use-interfaces-in-go&m=1 "http://en.wikipedia.org/wiki/Robustness_Principle")）。

我们也可能会尝试编写一些返回类型明确的函数，像这样：

```go
GetUser(*http.Request) (User, error)
```

但是这样又显得不够灵活，因为需要对不同的类型写不同的函数。我们真正需要的是像这样的一个设计：

```go
type Entity interface {
	UnmarshalerHTTP(*http.Request) error
}

func GetEntity(r *http.Request, v Entity) error {
	return v.UnmarshalerHTTP(r)
}
```

`GetEntiry` 方法需要传入一个参数，该参数为 `Entity` 接口类型，确保实现了 `UnmarshalHTTP` 方法。为了使用该方法，我们需要定义 `User` 类型并实现 `UnmarshalHTTP` 方法，并在方法中解析 HTTP 请求：

```go
type User struct {
   ...
}

func (u *User) UnmarshalHTTP(r *http.Request) error {
   // ...
}
```

然后，定义一个 `User` 类型的变量，并将其指针传递给 `GetEntity` 方法：

```go
var u User
if err := GetEntity(req, &u); err != nil {
    // ...
}
```

这同解析 JSON 数据类似。这种方式可以始终如一地安全地工作，因为 `var u User` 将自动地将 `User` 结构体初始化为零值。Go 不像其他语言一样声明和初始化是分开进行的。通过声明一个值而不初始化它，运行时将为该值分配适当的内存空间。即使我们的 `UnmarshalHTTP` 方法不能使用某些字段,这些字段也将包含有效的零数据，而不是垃圾数据。

### 结语

我希望读完此文后你可以更加得心应手地使用 Go 中的接口，记住下面这些结论：

*   通过考虑数据类型之间的相同功能来创建抽象，而不是相同字段
*   `interface{}` 的值不是任意类型，而是 `interface{}` 类型
*   接口包含两个字的大小，类似于 `(type, value)`
*   函数可以接受 `interface{}` 作为参数，但最好不要返回 `interface{}` 
*   指针类型可以调用其所指向的值的方法，反过来不可以
*   函数中的参数甚至接受者都是通过值传递
*   一个接口的值就是就是接口而已，跟指针没什么关系
*   如果你想在方法中修改指针所指向的值，使用 `*` 操作符
