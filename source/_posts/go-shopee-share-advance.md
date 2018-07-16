---
title: Golang 进阶分享
date: 2018-06-15 19:08:23
tags:
- go
categories:
- go
description: 组内分享
---

# go 调度模型
![](1.png)

* 抢占式调度
```go
func main() {
	// runtime.GOMAXPROCS(-1) 返回核数
	for i := 0; i < runtime.GOMAXPROCS(-1); i++ {
		go func(num int) {
			fmt.Printf("goroutine[%v] started\n", num)
			for {
			}
		}(i)
	}
	// 执行不到
	time.Sleep(time.Second)
	fmt.Println("Hello")
}
```

* 在函数调用时会检查当前 goroutine 是否应该让出资源

```go
func complexFunction(level int) {
	if level > 100 {
		return
	}
	complexFunction(level + 1)
}

func main() {
	for i := 0; i < runtime.GOMAXPROCS(-1); i++ {
		go func(num int) {
			fmt.Printf("goroutine[%v] started\n", num)
			for {
				complexFunction(0)
			}
		}(i)
	}
	time.Sleep(time.Second)
	fmt.Println("Hello")
}

// out
goroutine[6] started
goroutine[1] started
goroutine[0] started
goroutine[2] started
goroutine[5] started
goroutine[4] started
goroutine[7] started
goroutine[3] started
Hello
```

* 简单的函数可能会被编译器内联

```go
func simpleFunc() {
	a := 1
	a--
}

func main() {
	for i := 0; i < runtime.GOMAXPROCS(-1); i++ {
		go func(num int) {
			fmt.Printf("goroutine[%v] started\n", num)
			for {
				simpleFunc()
			}
		}(i)
  }
  // 永远执行不到
	time.Sleep(time.Second)
	fmt.Println("Hello")
}
```

# channel
* 无缓存 vs 有缓存

无缓冲的通道保证进行发送和接收的 goroutine 会在同一时间进行数据交换;有缓冲的 通道没有这种保证


![](2.png)

![](3.png)

可以理解为无缓存的通道是容量为 0 的缓冲通道。

一个例子：

```go
	c := make(chan int, 1)
	go func() {
		c <- 1
		fmt.Println("a")
	}()

	time.Sleep(time.Second)
  fmt.Println(<-c)

//
a
1

	c := make(chan int)
	go func() {
		c <- 1
		fmt.Println("a")
	}()

	time.Sleep(time.Second)
  fmt.Println(<-c)

//
1
```

* 判断 chan 的状态

```go
	c := make(chan int, 10)
	c <- 1
	c <- 2

	i, ok := <-c
	fmt.Println(i, ok)

	close(c)
	i, ok = <-c // 关闭了还是可以收
	fmt.Println(i, ok)

	i, ok = <-c // 通道里面没有值了，收到的是默认值，int 类型的默认值是 0
	fmt.Println(i, ok)
```

* 关闭
  * 不可以重复关闭
  * 一般由写入方关闭
  * 不关闭也可以，会被 GC 回收
  * 关闭后可读不可写
  * 关闭后读不会阻塞

* 利用 channel 产生质数 (不是很好理解)

```go
package main

import "fmt"

func appendPrimeFilterC(inputC <-chan int, prime int) chan int {
	nextC := make(chan int, 10)
	go func() {
		for e := range inputC {
			if e%prime == 0 && e != prime {
				continue
			}
			nextC <- e
		}
		close(nextC)
	}()
	return nextC
}

func seed(minNum, maxNum int) <-chan int {
	numC := make(chan int, 10)
	go func() {
		for i := minNum; i < maxNum; i++ {
			numC <- i
		}
		close(numC)
	}()
	return numC
}

func showPrime(begin, end int) {
	source := seed(begin, end)
	primC := appendPrimeFilterC(source, 2)
	for {
		num, notEmpty := <-primC
		if !notEmpty {
			break
		}
		fmt.Println(num)
		primC = appendPrimeFilterC(primC, num)
	}
}

func main() {
	showPrime(2, 100)
}
```

# range 的问题

* 迭代的变量是同一个

```go
    var m = map[string]int{
        "ONE": 1,
        "TWO": 2,
    }
    for k, v := range m {
        fmt.Println(k, v)
        fmt.Println(&k, &v)
    }

//
ONE 1
0xc42000e1f0 0xc4200140c8
TWO 2
0xc42000e1f0 0xc4200140c8
```

* 迭代过程删除

```go
    s := []int{1, 2, 3, 4, 5}
    for i, v := range s {
        fmt.Println(i, v)
        if v%2 == 0 {
            s = append(s[:i], s[i+1:]...)
        }
    }

//
0 1
1 2
2 4
3 5
4 5

// map 迭代过程中删除是安全的
    var m = map[string]int{
        "ONE":   1,
        "TWO":   2,
        "THREE": 3,
        "FOUR":  4,
        "FIVE":  5,
    }

    for k, v := range m {
        fmt.Println(k, v)
        if v%2 == 0 {
            delete(m, k)
        }
    }
    fmt.Println(m)

//
THREE 3
FOUR 4
FIVE 5
ONE 1
TWO 2
map[FIVE:5 ONE:1 THREE:3]
```

# select
* 随机选择一个准备好的通道
* 操作超时
```go
func main() {
    var c = make(chan struct{}, 10)
    // close(c)
    select {
    case <-time.After(time.Second):
        fmt.Println("TIMEOUT")
    case <-c:
        fmt.Println("OK")
    }
}
```
* 定时任务
```go
func main() {
    closed := make(chan struct{})
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    time.AfterFunc(3*time.Second, func() {
        close(closed)
    })
    for {
        select {
        case <-closed:
            fmt.Println("closed")
            return
        case <-ticker.C:
            fmt.Println("triggered")
        }
    }
}
```

# struct
* 不是类
* 不能继承
* 不能定义成员方法
* 可以定义带接收器的函数
* 接收器可以为 nil
```go
type Student struct {
    name string
}

func (s *Student) Name() string {
    if s == nil {
        return "invalid student"
    }
    return s.name
}

func main() {
    var stu *Student = nil
    fmt.Println(stu.Name())
}
```

## 匿名嵌入
* 复用嵌入结构体的属性
* 复用把嵌入结构体作为接收器的函数
* 问题
```go
package main

import "fmt"

type Human struct {
	id   int
	name string
}

func (h *Human) SetID(id int) { // = func setId(h *Human, id int)
	h.id = id
}

type Student struct {
	Human
	id int64
}

func main() {
	stu := &Student{
		Human: Human{},
	}
	fmt.Printf("%+v\n", stu)
	stu.SetID(2333)
	fmt.Printf("%+v\n", stu)
}
//
&{Human:{id:0 name:} id:0}
&{Human:{id:2333 name:} id:0}
```

# interface
* interface 的 nil 判断
```go
func isNil(i interface{}) bool {
    //    return reflect.ValueOf(i).IsNil() // true
    return i == nil // false
}

func main() {
    var stu *Student
    fmt.Println(stu == nil) // true
    fmt.Println(isNil(stu))
}
```

interface 会保存数据类型和数据的值对于 nil 而言，它的类型是 nil，值是 nil
对于传入的 stu 而言，它的类型是 *Student，值是 nil

# error 和 panic
* 尽量不用 panic
* 处理 panic 的姿势
```go
func NoPanic() {
    defer func() {
        if err := recover(); err != nil {
            fmt.Println("safe")
        }
    }()
    panic("BOOM")
}
```
* recover 的限制，只能处理当前 goroutine
```go
func NoPanic() {
    defer func() {
        if err := recover(); err != nil {
            fmt.Println("safe")
        }
    }()
    // panic at other goroutine.
    go panic("BOOM")
    // wait new goroutine running
    time.Sleep(time.Second)
}
```

# defer
* 执行顺序和栈一样

```go
func SayHello() {
    defer fmt.Println("Hello from defer 1")
    defer fmt.Println("Hello from defer 2")
    fmt.Println("Hello")
}
```

* 即使 panic 也会执行，这也是为什么可以在 defer 中 recover 的原因

```go
func SayHello() {
    defer fmt.Println("Hello from defer 1")
    panic("BOOM")
    defer fmt.Println("Hello from defer 2")
    fmt.Println("Hello")
}
```

* 常见使用姿势
  * 释放资源
  ```go
      resp, err := http.Get("https://shopee.tw")
    if err != nil {
        // handle error
    }
    defer resp.Body.Close()
    // handle response
  ```
  * 释放锁
  ```go
      lock.Lock()
    defer lock.Unlock()
  ```
  * 回滚事务
  ```go
  func updateSomething() {
    tx := db.Begin()
    defer tx.Rollback() // 如果提交了，这一句不会执行

    rows, err := tx.Query("do something")
    if err != nil {
        // handle error
        return
    }
    handleRows(rows)
    tx.Commit()
  }
  ```
* 通过 defer 执行的函数，他的参数是在 defer 时计算好的，而不是在执行时计算的