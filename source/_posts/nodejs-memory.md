---
title: nodejs内存控制
date: 2017-06-01 22:00:54
tags:
- nodejs
- cluster
categories:
- nodejs
description: 关于nodejs内存控制
---

对于前端工程师而言，很少遇到需要考虑对内存进行精确控制的场景。但是nodejs是服务器端编程，内存控制就显得尤为重要了。

# V8的垃圾回收机制与内存限制
## V8的内存限制
在node中通过javascript使用内存是会有内存限制：

* 64位：1.4G
* 32位：0.7G

要知晓V8为何限制了内存的用量，需要回归到V8在内存使用上的策略。

## V8的对象分配
V8中，所有的js对象都是通过堆来进行分配的。

```javascript
youxingzhideMac-mini:blog ayou$ node
> process.memoryUsage()
{ rss: 22544384, heapTotal: 10522624, heapUsed: 5131240 }
```

heapTotal是已经申请到的内存，heapUsed是正在使用的内存。如果已申请的堆空间内存不够分配新的对象，将继续申请堆内存，直到堆得大小超过V8的限制为止。

为什么要限制内存？垃圾回收机制的限制。以1.5GB的垃圾回收堆内存为例，做一次晓得垃圾回收需要50毫秒以上，做一次非增量式的垃圾回收需要1秒以上。这是引起javascript线程暂停执行的时间，会使得应用的性能和响应能力都下降，所以限制堆内存是一个好的选择。

可以通过如下方法打开：

```javascript
node --max-old-space-size=1700 test.js // MB
//
node --max-new-space-size=1700 test.js // KB
```

## V8了垃圾回收机制
V8的垃圾回收策略主要基于分代式垃圾回收机制。在自动垃圾回收的演变中，人们发现没有一种垃圾回收算法能够胜任所有场景。因为在实际的应用中，对象的生存周期长短不一。为此，现代的垃圾回收算法中按对象的存活时间将内存的垃圾回收进行不同的分代，然后分别对不同分代的内存施以更高效的算法。

### 内存分代
* 新生代：由两个reserved_semispace_size_构成，最大值：64位32MB，32位16MB
* 老生代

V8堆的整体大小 = 新生代 + 老生代

### scavenge算法
这是新生代中的对象主要回收方法，在其具体实现中，主要采用了Cheney：

* 将新生代内存一分为二，每一部分成为semispace
* 只有一个空间处于使用状态，称为From空间，处于闲置状态的为To空间
* 当开始进行垃圾回收时，会检查From空间的存活对象，这些存活对象被复制到To空间中，非活动对象被释放
* 完成复制后From空间和To空间的角色对换

该算法用空间换时间，特别适合应用在新生代中，因为新生代中对象的生命周期较短

如果一个对象经过多次复制依然存在，则需要对其进行晋升（移到到老生代）。有两个条件

* 是否经历过回收
* To空间是否使用超过了25%

### Mark-Sweep(标记-清除) & Mark-Compact(标记-整理)
* Mark-Sweep：在标记阶段，遍历堆中的所有对象，并标记活着的对象，在随后的清除阶段，清除没有标记的对象。由于死对象（没有标记）在老生代中只占小部分，所以该方法适合老生代。其最大问题是，每次清除后，内存会出现碎片，影响后面的内存分配。

* Mark-Compact：为了解决上面的碎片问题而提出的，在标记完后，将活着的对象往一端移动，移动完成后，直接清理边界外的内存。

由于Mark-Compact相比Mark-Sweep要慢，所以V8中主要还是以Mark-Sweep为主，在空间不足以对晋升过来的对象进行分配时才使用Mark-Compact。

### Incremental Marking
前三种垃圾回收算法都需要“停顿”，这对新生代还好，但是老生代由于由于比较大，停顿一次的时间就不能忍受了。所以，提出一种“增量式标记”的方法，即每标记一部分就让应用逻辑执行一会，这样交替执行直到标记阶段完成。同理，清除和整理也可以是增量式的。

为了充分利用多核CPU的性能，还可以采用并行标记和清理的方式。



# 高效使用内存
在js中，无法立即回收的内存有闭包和全局变量引用这两种情况。要十分小心此类变量是否无限制增加，因为它会导致老生代中的对象增多。

# 内存指标
* rss是resident set size的缩写，即进程的常驻内存部分。
* node的内存构成主要由通过V8进行分配的部分和Node自行分配的部分。
* 受V8的垃圾回收限制的主要是V8的堆内存

# 内存泄漏
一般有如下原因：

* 缓存
* 队列消费不及时
* 作用域未释放

## 慎将内存当做缓存
* 缓存限制策略
* 外部缓存

# 内存泄漏排查
先构造一份包含内存泄漏的代码：

```javascript
var http = require('http')

var leakArray = []
var leak = function () {
  leakArray.push("leak" + Math.random())
}

http.createServer((req, res) => {
  leak()
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World\n')
}).listen(1337)
```

下面测试下``node-heapdump``和``node-memwatch``这两个工具

## node-heapdump
在代码头部增加``var heapdump = require('heapdump')``，通过终端发送命令``kill -USR2 <pid>``，会生成类似``heapdump-8030961.310539.heapsnapshot``的文件。

## node-memwatch
暂略

# 大内存应用
* 使用流
	
	```javascript
	var reader = fs.createReadStream('in.txt')
	var writer = fs.createWriteStream('out.txt')
	```
	
* 使用Buffer

	




