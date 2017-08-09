---
title: 笔记-javascript高级程序设计（第3版）第22章
date: 2017-08-08 16:01:21
tags:
- javascript
categories:
- 读书笔记
description: 一些高级技巧
---

# 高级函数
## 安全的类型检测
```javascript
Object.prototype.toString.call(obj) === '[object Array]'
```

## 作用域安全的构造函数
```javascript
function Person(name, age, job) {
	if (this instanceof Person) {
		this.name = name
		this.age = age
		this.job = job
	} else {
		return new Person(name, age, job)
	}
}
```

但是，这样会影响继承：

```javascript
function Polygon (sides) {
  // this 是Rectangle的实例
  if (this instanceof Polygon) {
    this.sides = sides
    this.getArea = function () {
      return 0
    }
  } else {
    return new Polygon(sides)
  }
}

function Rectangle (width, height) {
  Polygon.call(this, 4)
  this.width = width
  this.height = height
  this.getArea = function () {
    return this.width * this.height
  }
}

var rect = new Rectangle(5, 10)
console.log(rect.sides) // undefined
```

必须将Polygon的prototype添加到原型链上

```javascript
Rectangle.prototype = new Polygon()
```

## 惰性载入函数
```javascript
function createXHR() {
	if () {
	} else if () {
	} else {
	}
}
```

每次调用这个函数都要去判断，有点浪费，可以改写成这样子：

```javascript
function createXHR() {
	if () {
		createXHR = function(){}
	} else if () {
		createXHR = function(){}
	} else {
		createXHR = function(){}
	}
}
```

另外一种方式：

```javascript
var createXHR = (function(){
	if () {
		return function(){}
	} else if () {
		return function(){}
	} else {
		return function(){}
	}
})()
```

# 函数绑定
下面是自己实现的bind的例子

```javascript
function bind(fn, context) {
  if (arguments.length < 2) {
    throw new Error('arguments\' length cannot be less than 2')
  }
  var args = [].slice.call(arguments, 2)
  return function () {
    return fn.apply(context, [].concat.call(args, [].slice.call(arguments)))
  }
}

var obj = {
  a: 'ayou',
  func: function () {
    return this.a + ": " + [].join.call(arguments, ' ')
  }
}
try {
  var f = bind(obj.func, obj, 'I')
  console.log(f('love', 'you'))
  console.log(f('hate', 'you'))
} catch (err) {
  console.log(err.message)
}
// 输出
ayou: I love you
ayou: I hate you
```

# 函数柯里化

```javascript
function curry (fn) {
  var args = [].slice.call(arguments, 1)
  return function () {
    return fn.apply(null, args.concat([].slice.call(arguments)))
  }
}

function add() {
  return [].reduce.call(arguments, function (a, b) {
    return a + b
  })
}

var curryFn = curry(add, 10)
console.log(curryFn()) // 10
console.log(curryFn(1,2,3)) // 16
console.log(curryFn(4,5,6)) // 25
```

# 防篡改对象
级别由低到高分为：

* 不可拓展对象
* 密封对象
* 冻结对象

## 不可拓展对象
```javascript
var person = {name: 'ayou'}
Object.preventExtensions(person)

person.age = 29
console.log(person) // {name: 'ayou'}
console.log(Object.isExtensible(person)) // false

delete person.name // 可删除属性
console.log(person) // {}
```

## 密封的对象
```javascript
var person = {name: 'ayou'}
Object.seal(person)

person.age = 29 // 严格模式下报错
console.log(person) // {name: 'ayou'}

delete person.name // 严格模式下报错
console.log(person) // {name: 'ayou'}

person.name = 'xingzhi' // 可修改属性值
console.log(person) // {name: 'xingzhi'}

console.log(Object.isSealed(person)) // true
console.log(Object.isExtensible(person)) // false
```

## 冻结的对象
```javascript
var person = {name: 'ayou'}
Object.freeze(person)

person.age = 29
console.log(person) // { name: 'ayou' }

delete person.name
console.log(person) // { name: 'ayou' }

person.name = 'xingzhi'
console.log(person) // { name: 'ayou' }

console.log(Object.isExtensible(person)) // false
console.log(Object.isSealed(person)) // true
console.log(Object.isFrozen(person)) // true
```

# 高级定时器
## 用setTimeout模拟setInterval
```javascript
setTimeout(function () {
  console.log(1)
  setTimeout(arguments.callee, 1000)
}, 1000)
```

## Yielding Processes（数组分块技术）
```javascript
function chunk (array, process, context) {
  setTimeout(function () {
    var item = array.shift()
    process.call(context, item)

    if (array.length > 0) {
        setTimeout(arguments.callee, 100)
    }
  }, 100)
}
```

## 函数节流
```javascript
function throttle(fn, context) {
  var arg = [].slice.call(arguments, 2)
  clearTimeout(fn.tId)
  fn.tId = setTimeout(function () {
    fn.apply(context, arg)
  }, 100)
}

function say(msg) {
  console.log(msg)
}

for (var i = 0; i < 10; i++) {
  throttle(say, null, 'hello') // 只打印一次
}
```

# 自定义事件
```javascript
function EventTarget() {
  this.handlers = {}
}

EventTarget.prototype = {
  constructor: EventTarget,
  addHandler: function (type, handler) {
    if (typeof this.handlers[type] === 'undefined') {
      this.handlers[type] = []
    }
    this.handlers[type].push(handler)
  },
  fire: function (event) {
    if (!event.target) {
      event.target = this
    }
    if (this.handlers[event.type] instanceof Array) {
      var handlers = this.handlers[event.type]
      for (var i=0, len=handlers.length; i < len; i++) {
        handlers[i](event)
      }
    }
  },
  removeHandler: function (type, handler) {
    if (this.handlers[type] instanceof Array) {
      var handlers = this.handlers[type]
      for (var i=0, len=handlers.length; i < len; i++) {
        if (handlers[i] === handler) {
          break
        }
      }
      handlers.splice(i, 1)
    }
  }
}

var event = new EventTarget()

function handleMessage(event) {
  console.log("Message: " + event.message)
}
event.addHandler("message", handleMessage)
event.fire({ type: 'message', message: 'Hello World!'})
event.removeHandler("message", handleMessage)
event.fire({ type: 'message', message: 'Hello World2!'})
```

将其混入进其他类：

```javascript
function Person(name, age) {
  EventTarget.call(this)
  this.name = name
  this.age = age
}

function inheritPrototype(target, src) {
  function F() {}
  F.prototype = src.prototype
  target.prototype = new F()
  target.prototype.constructor = target
}

inheritPrototype(Person, EventTarget)

Person.prototype.say = function (message) {
  this.fire({type: 'message', message: message})
}

var person  = new Person('ayou', 29)
person.addHandler("message", handleMessage)
person.say('Hi nieling')
```
