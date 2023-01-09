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

如上所示，我们通过 `@Reflect.metadata('params', [TestService])` 在 `Test` 上添加了元数据，表示构造函数中需要用到 `TestService`，但 `Nest.js` 中好像不需要这样。怎么办呢？答案就是：

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

const D = (): ClassDecorator => (target) => {}

@D()
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

原因在于开启 `emitDecoratorMetadata` 后，TS 自动会在我们的装饰器前添加一些装饰器。比如，下面这段代码：

```ts
import 'reflect-metadata'

const D = (): ClassDecorator => (target) => {}

const methodDecorator = (): MethodDecorator => (target, key, descriptor) => {}

@D()
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
const D = () => (target) => {}
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
  [D(), __metadata('design:paramtypes', [Number])],
  Test
)
```

可以看到，TS 自动会添加 `design:type|paramtypes|returntype` 三种类型的元数据，分别表示目标本身，参数以及返回值的类型。

我们把 `inject` 稍微改一下，支持递归的注入，这样一个简单的依赖注入就实现了：

```ts
import 'reflect-metadata'

const D = (): ClassDecorator => (target) => {}

class OtherService {}

@D()
class TestService {
  constructor(otherService: OtherService) {}
}

@D()
class Test {
  constructor(testService: TestService) {}
  public hello(): string {
    return 'hello world'
  }
}

type Constructor<T = any> = new (...args: any[]) => T

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

inject(Test).hello()
```

接下来，我们浅看一下 `Nest.js` 大概是怎么实现的。

# 浅析 Nest.js 实现依赖注入的过程

我们通过官方脚手架生成一个 Demo 项目，可以发现其中 `tsconfig.json` 中的 `emitDecoratorMetadata` 确实是开启的。我们先用一个最简单的例子来说明：

```ts
// app.module.ts
import {Injectable, Module} from '@nestjs/common'

@Injectable()
class TestService {
  hello() {
    return 'hello world'
  }
}

@Module({
  providers: [TestService],
})
export class AppModule {
  constructor(testService: TestService) {
    testService.hello()
  }
}

// main.ts
import {NestFactory} from '@nestjs/core'
import {AppModule} from './app.module'
async function bootstrap() {
  await NestFactory.create(AppModule)
}
bootstrap()
```

为了更加直观的理解流程，这里暂时先把源码核心部分扒下来，我们把 `await NestFactory.create(AppModule)` 替换成我们自己的代码：

```ts
const injector = new Injector()
await injector.inject(AppModule)
```

```ts
import {Type} from '@nestjs/common'
import {MODULE_METADATA} from '@nestjs/common/constants'
import {ApplicationConfig, NestContainer} from '@nestjs/core'
import {InstanceLoader} from '@nestjs/core/injector/instance-loader'

export default class Injector {
  container: NestContainer

  public async inject(module: any) {
    const applicationConfig = new ApplicationConfig()
    this.container = new NestContainer(applicationConfig)
    const moduleInstance = await this.container.addModule(module, null)
    // 1 resolve dependencies
    const {token, metatype} = moduleInstance
    this.reflectProviders(metatype, token)
    // 2 create instance
    const instanceLoader = new InstanceLoader(this.container)
    instanceLoader.createInstancesOfDependencies()
  }

  public reflectProviders(module: Type<any>, token: string) {
    const providers = [
      ...this.reflectMetadata(MODULE_METADATA.PROVIDERS, module),
    ]
    providers.forEach((provider) => {
      return this.container.addProvider(provider as Type<any>, token)
    })
  }

  public reflectMetadata(metadataKey: string, metatype: Type<any>) {
    return Reflect.getMetadata(metadataKey, metatype) || []
  }
}
```

这里大概分成两部分：

1. 处理 `module` 的依赖，也就是 `@Module` 装饰器所声明的，我们这里暂时只考虑 `providers`。这一步执行完后，`NestContainer` 中数据如下（注意到 `Module` 本身也作为自己的 `provider`）：

```bash
{
  modules: {
    '19bb8f429cacdbcc18fc1afcaac891a4606578aa': Module {
      _metatype: class AppModule {...},
      _providers: {
        class AppModule {...}: InstanceWrapper {}, // Module 本身也作为自己的 provider
        class TestService {...}: InstanceWrapper {}
      }
    }
  }
}
```

2. 实例化 `Module`。这一部分需要稍微看一下源码：

```ts
public async createInstancesOfDependencies(
  modules: Map<string, Module> = this.container.getModules(),
) {
  ...
  await this.createInstances(modules);
}
...
private async createInstances(modules: Map<string, Module>) {
  await Promise.all(
    [...modules.values()].map(async moduleRef => {
      await this.createInstancesOfProviders(moduleRef);
      ...
    }),
  );
}
```

这里的意思是实例化所有的 `Module`，实例化 `Module` 前，我们需要先实例化它的依赖，具体到这里就是实例化 `providers`：

```ts
private async createInstancesOfProviders(moduleRef: Module) {
  const { providers } = moduleRef;
  const wrappers = [...providers.values()];
  await Promise.all(
    wrappers.map(item => this.injector.loadProvider(item, moduleRef)),
  );
}
```

最后会到 `loadInstance` 这个函数：

```ts
  public async loadInstance<T>(
    wrapper: InstanceWrapper<T>,
    collection: Map<InstanceToken, InstanceWrapper>,
    moduleRef: Module,
    contextId = STATIC_CONTEXT,
    inquirer?: InstanceWrapper,
  ) {
    ...
    try {
      const callback = async (instances: unknown[]) => {
        const properties = await this.resolveProperties(
          wrapper,
          moduleRef,
          inject as InjectionToken[],
          contextId,
          wrapper,
          inquirer,
        );
        const instance = await this.instantiateClass(
          instances,
          wrapper,
          targetWrapper,
          contextId,
          inquirer,
        );
        this.applyProperties(instance, properties);
        done();
      };
      await this.resolveConstructorParams<T>(
        wrapper,
        moduleRef,
        inject as InjectionToken[],
        callback,
        contextId,
        wrapper,
        inquirer,
      );
    } catch (err) {
      done(err);
      throw err;
    }
  }
```

接下来就到了最重要的 `this.resolveConstructorParams` 这个函数了，我们以 `class AppModule` 这个 `provider` 为例来分析：

```ts
public async resolveConstructorParams<T>(
    wrapper: InstanceWrapper<T>,
    moduleRef: Module,
    inject: InjectorDependency[],
    callback: (args: unknown[]) => void | Promise<void>,
    contextId = STATIC_CONTEXT,
    inquirer?: InstanceWrapper,
    parentInquirer?: InstanceWrapper,
  ) {
    // dependencies 返回的就是 AppModule 构造函数的参数类型，本例为： [TestService]
    const [dependencies, optionalDependenciesIds] = isFactoryProvider
      ? this.getFactoryProviderDependencies(wrapper)
      : this.getClassDependencies(wrapper);

    let isResolved = true;
    const resolveParam = async (param: unknown, index: number) => {
      ...
    };
    // 这里的 instances 就是通过 dependencies 实例化后的对象，具体到本例，可以理解为这样： [new TestService()]
    const instances = await Promise.all(dependencies.map(resolveParam));
    isResolved && (await callback(instances));
  }
```

其中调用 `this.getClassDependencies(wrapper)` 最终会调用 `reflectConstructorParams`：

```ts
  public reflectConstructorParams<T>(type: Type<T>): any[] {
    const paramtypes = Reflect.getMetadata(PARAMTYPES_METADATA, type) || [];
    const selfParams = this.reflectSelfParams<T>(type);

    selfParams.forEach(({ index, param }) => (paramtypes[index] = param));
    return paramtypes;
  }
```

这里的 `PARAMTYPES_METADATA` 就是 `design:paramtypes`。

终于看到了我们想要的结果，那本文暂时就分析到这里吧，这样一次带着一个问题看源码，目标明确，不至于陷入源码的汪洋大海之中。

# 总结

本文先通过几个简单的例子揭示了 TS 中如何实现依赖注入，核心原理在于通过 `Decorator` 及 `Metadata` 两大特性可以在类及其方法上存储一些数据，并且开启了 `emitDecoratorMetadata` 后，TS 还可以自动添加三种类型的数据。

然后简单地调试了 `Nest.js` 的初始化过程，发现原理与我们分析的类似。
