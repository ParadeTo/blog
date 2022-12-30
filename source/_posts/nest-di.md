---
title: Nest.js 之依赖注入
date: 2022-12-28 17:57:24
tags:
  - nestjs
categories:
  - nodejs
description: 搞懂 Nest.js 依赖注入的原理
---

# 前言

很久之前初学 `Java` 时就对注解及自动依赖注入这种方式感觉到不可思议，但是一直没有勇气（懒）去搞清楚。现在做前端了，发现 Nest.js 里面竟然也是这玩意，终究还是躲不过，那就趁着“阳康”了搞清楚一下吧。

关于为什么要进行依赖注入这里就不展开了，下面直接进入正题，TypeScript 依赖注入的原理。

# TypeScript 依赖注入的原理

TypeScript 中实现依赖注入离不开 `Decorator` 和 `Metadata`（需要引入第三方库 `reflect-metadata`），下面通过一个简单的例子来快速了解它的用途：

```ts
import 'reflect-metadata'

@Reflect.metadata('class', 'Class Data')
class Test {
  @Reflect.metadata('method', 'Method Data')
  public hello(): string {
    return 'hello world'
  }
}

console.log(Reflect.getMetadata('class', Test)) // Class Data
console.log(Reflect.getMetadata('method', new Test(), 'hello')) // Method Data
```

通过例子可以看到，我们通过 `Reflect.metadata()` 这个装饰器可以往类及其方法上面添加数据，然后通过 `Reflect.getMetadata` 可以取到这些数据。我们可以借助这一特性，实现简单的依赖注入：

```ts
import 'reflect-metadata'

class TestService {}

@Reflect.metadata('params', [TestService])
class Test {
  constructor(testService: TestService) {}
  public hello(): string {
    return 'hello world'
  }
}

type Constructor<T = any> = new (...args: any[]) => T

const inject = <T>(target: Constructor<T>): T => {
  const providers = Reflect.getMetadata('params', target)
  const args = providers.map((provider: Constructor) => new provider())
  return new target(...args)
}

inject(Test).hello()
```

但是，这个仍然需要手动添加数据，还是不够自动化，有没有更好的方式呢？答案如下：

```json
{
  "compilerOptions": {
    "emitDecoratorMetadata": true
  }
}
```

开启了这个参数后，我们就不需要手动添加元数据了：

```ts
import 'reflect-metadata'

class TestService {}

const Injectable = (): ClassDecorator => (target) => {}

@Injectable()
class Test {
  constructor(testService: TestService) {}
  public hello(): string {
    return 'hello world'
  }
}

type Constructor<T = any> = new (...args: any[]) => T

const inject = <T>(target: Constructor<T>): T => {
  const providers = Reflect.getMetadata('design:paramtypes', target)
  const args = providers.map((provider: Constructor) => new provider())
  return new target(...args)
}

inject(Test).hello()
```

原因在于 TS 自动会给我们添加一些装饰器，不过只会在我们已经添加过装饰器的地方添加。比如，下面这段代码：

```ts
import 'reflect-metadata'

const Injectable = (): ClassDecorator => (target) => {}

const methodDecorator = (): MethodDecorator => (target, key, descriptor) => {}

@Injectable()
class Test {
  constructor(a: number) {}

  @methodDecorator()
  public hello(): string {
    return 'hello world'
  }

  public hi() {}
}
```

编译过后是这样子的：

```js
var __decorate = ...
var __metadata = ...
import 'reflect-metadata'
const Injectable = () => (target) => {}
const methodDecorator = () => (target, key, descriptor) => {}
let Test = class Test {
  constructor(a) {}
  hello() {
    return 'hello world'
  }
  hi() {}
}
__decorate(
  [
    methodDecorator(),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', []),
    __metadata('design:returntype', String),
  ],
  Test.prototype,
  'hello',
  null
)
Test = __decorate(
  [Injectable(), __metadata('design:paramtypes', [Number])],
  Test
)
```

可以看到，TS 自动会添加 `design:type|paramtypes|returntype` 三种类型的元数据，分别表示目标本身，参数以及返回值的类型。

我们把 `inject` 稍微改一下，从而支持递归的注入：

```ts
const inject = <T>(target: Constructor<T>): T => {
  const providers = Reflect.getMetadata('design:paramtypes', target)
  if (providers) {
    const args = providers.map((provider: Constructor) => {
      return inject(provider)
    })
    return new target(...args)
  }
  return new target()
}
```
