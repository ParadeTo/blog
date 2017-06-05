---
title: nodejs之Buffer
date: 2017-06-04 11:40:49
tags:
- nodejs
- cluster
categories:
- nodejs
description: 关于nodejs的Buffer
---

# Buffer结构
## Buffer对象
* 类似于数组
* 为16进制的两位数，即0到255的数值(一个字节)
* 如果赋值小于0，就逐次加256，直到得到一个0到255之间的整数；反之，逐次减256...

```javascript
var buf = new Buffer(100)
```

## 内存分配
* 在C++层面申请内存、在JavaScript中分配内存
* slab动态内存管理机制

**分配小Buffer对象**

```javascript
// 新构造一个slab
Buffer.poolSize = 8 * 1024
var pool
function allocPool() {
	pool = new SlowBuffer(Buffer.poolSize)
	pool.used = 0
}
// 初次分配一个Buffer对象
new Buffer(1024)
if (!pool || pool.length - pool.used < this.length) allocPool()
this.parent = pool
this.offset = pool.offset
pool.used += this.length
if (pool.used & 7) pool.used = (pool.used + 8) & ~7
```

如果slab剩余的空间不够，将会构造新的slab，原slab中剩余的空间会被浪费。

只有当slab中的所有Buffer对象都可以回收时，slab的空间才会被回收。

**分配大Buffer对象**

```javascript
this.parent = new SlowBuffer(this.length)
this.offset = 0
```

# Buffer的转换
## 字符串转Buffer
```javascript
var a = new Buffer('我') // 默认为utf-8
<Buffer e6 88 91>
var b = new Buffer('我','ascii')
<Buffer 11>
```

```javascript
var b = new Buffer(4)
b.write('我',0,1,'ascii')
b.write('我',1,3)
<Buffer 11 e6 88 91>
```

## Buffer转字符串
```javascript
buf.toString([encoding], [start], [end]) // 默认为utf-8
```

## 不支持的编码类型
用``Buffer.isEncoding(encoding)``来判断是否支持某一种类型，不支持GBK, GB2312, BIG-5

可以使用``iconv``和``iconv-lite``来支持更多的编码类型

# Buffer的拼接
Buffer在使用场景中，通常是以一段段的方式传输，在Buffer的拼接过程中，要非常小心，例如：

```javascript
var fs = require('fs')

var rs = fs.createReadStream('./test.md', {highWaterMark: 11})
var data = ''
rs.on("data", function (chunk) {
  data += chunk // data = data + chunk.toString()
})
rs.on("end", function () {
  console.log(data)
})

床前明���光，疑���地上霜。举头���明月，���头思故乡。
```

## 乱码产生的原因
增加一些辅助代码后，可以非常看到乱码产生的过程
```javascript
var fs = require('fs')

var rs = fs.createReadStream('./test.md', {highWaterMark: 11})
var data = ''
var buffer = new Buffer(200)
var i = 0
rs.on("data", function (chunk) {
  for (let j = 0; j < chunk.length; j++) {
    buffer[i++] = chunk[j]
  }
  console.log(chunk)
  console.log(chunk.toString())
  data += chunk // data = data + chunk.toString()
})
rs.on("end", function () {
  console.log(data)
  console.log(buffer)
})

<Buffer e5 ba 8a e5 89 8d e6 98 8e e6 9c>
床前明��
<Buffer 88 e5 85 89 ef bc 8c e7 96 91 e6>
�光，疑�
<Buffer 98 af e5 9c b0 e4 b8 8a e9 9c 9c>
��地上霜
<Buffer e3 80 82 e4 b8 be e5 a4 b4 e6 9c>
。举头��
<Buffer 9b e6 98 8e e6 9c 88 ef bc 8c e4>
�明月，�
<Buffer bd 8e e5 a4 b4 e6 80 9d e6 95 85>
��头思故
<Buffer e4 b9 a1 e3 80 82>
乡。
床前明���光，疑���地上霜。举头���明月，���头思故乡。
<Buffer e5 ba 8a e5 89 8d e6 98 8e e6 9c 88 e5 85 89 ef bc 8c e7 96 91 e6 98 af e5 9c b0 e4 b8 8a e9 9c 9c e3 80 82 e4 b8 be e5 a4 b4 e6 9c 9b e6 98 8e e6 9c ... >
```
## setEncoding()与string_decoder()
可读流有一个``setEncoding``的方法，可以让data事件中传递的不再是Buffer对象，而是编码后的字符串。

```javascript
var rs = fs.createReadStream('./test.md', {highWaterMark: 11})
rs.setEncoding('utf8')
...
```

其背后实际上是可读流在内部设置了一个decoder对象，每次data事件都通过该对象进行Buffer到字符串的解码。但是这并没有解决截断的问题，到底是怎么回事可以通过下面这个例子来说明：

```javascript
var StringDecoder = require('string_decoder').StringDecoder
var decoder = new StringDecoder()
var buf1 = new Buffer([0xe5, 0xba, 0x8a, 0xe5, 0x89, 0x8d, 0xe6, 0x98, 0x8e, 0xe6, 0x9c])
console.log(decoder.write(buf1))
床前明
var buf2 = new Buffer([0x88, 0xe5, 0x85, 0x89, 0xef, 0xbc, 0x8c, 0xe7, 0x896, 0x91, 0xe6])
console.log(decoder.write(buf2))
月光，疑
```

UTF-8的编码规则如下：

Number of bytes|Bits for code point|First code point|Last code point|Byte 1|Byte 2|	Byte 3|Byte 4
---|---|---|---|---|---|---|---
1|7|U+0000|U+007F|0xxxxxxx|-|-|-			
2|11|U+0080|U+07FF|110xxxxx|10xxxxxx|-|-
3|16|U+0800|U+FFFF|1110xxxx|10xxxxxx|10xxxxxx|-
4|21|U+10000|U+10FFFF|11110xxx|10xxxxxx|10xxxxxx|10xxxxxx

上面例子在处理buf1时，前面九个元素刚好符合UTF8的编码规则，所以输出无误。当处理到``Oxe6``时，按照编码规则，后面应该再接上2个字节（一共三个字节）一起进行编码，而此时只有2个字节，所以这两个字节被保留在StringDecoder实例内部，放到后面继续处理。

目前只能处理UTF-8，Base64，和UCS-2/UTF-16LE这三种编码。

## 正确的拼接Buffer

