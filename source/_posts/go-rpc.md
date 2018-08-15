---
title: Go RPC示例
date: 2018-08-15 17:04:08
tags:
- go
categories:
- go
---

# 概念
所谓 RPC (Remote Procedure Call)，即远程过程调用，是一个计算机通信协议。该协议允许运行于一台计算机的程序调用另一台计算机的子程序，而程序员无需额外地为这个交互作用编程。（参考维基百科）

下面让我们来试一试：

# DemoService
我们新建一个 `DemoService`，提供一个 `Div` 的方法，其第一个参数是一个类型为 `Args` 的参数，第二个参数用于接受函数返回值。为什么要这样写，因为这是约定。

```go
package rpcdemo

import "errors"

// Service.Method
type DemoService struct {}

type Args struct {
	A, B int
}

func (DemoService) Div(args Args, result *float64) error {
	if args.B == 0 {
		return errors.New("division by zero")
	}

	*result = float64(args.A) / float64(args.B)
	return nil
}

```

# RPC Server
接下来，我们启动一个 RPC Server 监听 1234 端口，并将上面的 `DemoService` 注册到其中。
```go
package main

import (
	"log"
	"net"
	"net/rpc"
	"net/rpc/jsonrpc"

	"../rpcdemo"
)

func main() {
	rpc.Register(rpcdemo.DemoService{})
	listener, err := net.Listen("tcp", ":1234")
	if err != nil {
		panic(err)
	}

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("accept error: %v", err)
		}

		go jsonrpc.ServeConn(conn)
	}
}
```

# RPC Client
接下来我们编写 client：
```go
package main

import (
	"fmt"
	"net"
	"net/rpc/jsonrpc"

	"../rpcdemo"
)

func main() {
	conn, err := net.Dial("tcp", ":1234")
	if err != nil {
		panic(err)
	}

	client := jsonrpc.NewClient(conn)

	var result float64
	err = client.Call("DemoService.Div", rpcdemo.Args{10, 3}, &result)
	fmt.Println(result, err)

	err = client.Call("DemoService.Div", rpcdemo.Args{10, 0}, &result)
	fmt.Println(result, err)
}

```

运行 client，得到：

```go
3.3333333333333335 <nil>
3.3333333333333335 division by zero
```

让我们用 node 再来一遍吧：
```javascript
const net = require('net')

const client = new net.Socket()

client.connect(1234, '127.0.0.1', function () {
  client.write(JSON.stringify({
    'method': 'DemoService.Div',
    'params': [{
      'A': 3,
      'B': 4
    }],
    'id': 1
  }))
})

client.on('data', function (data) {
  const obj = JSON.parse(data.toString())
  console.log(obj) // { id: 1, result: 0.75, error: null }
  client.destroy()
})

client.on('close', function () {
  console.log('closed')
})

```

# 总结
这个例子其实很简单，但是透过这个例子我们可以发现，RPC 跟 HTTP 貌似没什么差别嘛，不都是客户端给服务端发点参数，然后服务端干活得到结果，返回给客户端。不同之处是 RPC 比 HTTP 简洁，少了很多头部信息。个人认为 HTTP 就是 RPC 的一种实现方式。