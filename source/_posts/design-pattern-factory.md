---
title: 设计模式之各种工厂模式（TypeScript & Rust）
date: 2024-03-13 20:54:42
tags:
  - Design Pattern
categories:
  - rust
---

设计模式中带“工厂”两个字的有：简单工厂模式、工厂方法模式、抽象工厂模式。下面用 TypeScript 和 Rust 分别演示一下：

# 简单工厂模式

听说 NBA 有个专门用于生产控球后卫的工厂，保罗和纳什都出自于此，用简单工厂模式是这么实现的：

## TypeScript

```ts
interface PointGuard {
  assist(): void
}

class Paul implements PointGuard {
  assist(): void {
    console.log('Paul assist')
  }
}

class Nash implements PointGuard {
  assist(): void {
    console.log('Nash assist')
  }
}

class SimplePointGuardFactory {
  createPointGuard(pointGuardType: string): PointGuard {
    switch (pointGuardType) {
      case 'P':
        return new Paul()
      case 'N':
        return new Nash()
      default:
        throw new Error('Invalid point guard')
    }
  }
}

const factory: SimplePointGuardFactory = new SimplePointGuardFactory()
const paul: PointGuard = factory.createPointGuard('P')
paul.assist()
const nash: PointGuard = factory.createPointGuard('N')
nash.assist()
```

## Rust

```rust
pub trait PointGuard {
    fn assist(&self);
}

struct Paul;

impl PointGuard for Paul {
    fn assist(&self) {
        println!("Paul assist");
    }
}

struct Nash;

impl PointGuard for Nash {
    fn assist(&self) {
        println!("Nash assist");
    }
}

pub struct SimplePointGuardFactory;

impl SimplePointGuardFactory {
    pub fn new() -> Self {
        Self {}
    }
    pub fn create_point_guard(&self, point_guard_type: &str) -> Box<dyn PointGuard> {
        match point_guard_type {
            "P" => Box::new(Paul),
            "N" => Box::new(Nash),
            _ => panic!("Invalid point guard"),
        }
    }
}

fn main() {
    let factory = SimplePointGuardFactory::new();
    let paul = factory.create_point_guard("P");
    paul.assist();
    let nash = factory.create_point_guard("N");
    nash.assist();
}
```

普通工厂概念还是比较简单的，缺点是当需要新增一个“控球后卫”时，需要改动 `SimplePointGuardFactory`，同时随着“控球后卫”越来越多，工厂的代码会变得无比庞大。所以就出现了工厂方法模式。

# 工厂方法模式

## TypeScript

```ts
interface PointGuard {
  assist(): void
}

class Paul implements PointGuard {
  assist(): void {
    console.log('Paul assist')
  }
}

class Nash implements PointGuard {
  assist(): void {
    console.log('Nash assist')
  }
}

interface PointGuardFactory {
  create_point_guard(): PointGuard
}

class PaulFactory implements PointGuardFactory {
  create_point_guard(): PointGuard {
    return new Paul()
  }
}

class NashFactory implements PointGuardFactory {
  create_point_guard(): PointGuard {
    return new Nash()
  }
}

function assist(factory: PointGuardFactory) {
  const pointGuard = factory.create_point_guard()
  pointGuard.assist()
}

assist(new PaulFactory())
assist(new NashFactory())
```

## Rust

```rust
pub trait PointGuard {
    fn assist(&self);
}

pub struct Paul;

impl PointGuard for Paul {
    fn assist(&self) {
        println!("Paul assist");
    }
}

struct Nash;

impl PointGuard for Nash {
    fn assist(&self) {
        println!("Nash assist");
    }
}

pub trait Factory {
    fn create_point_guard(&self) -> Box<dyn PointGuard>;
}

pub struct PaulFactory;

impl Factory for PaulFactory {
    fn create_point_guard(&self) -> Box<dyn PointGuard> {
        Box::new(Paul)
    }
}

pub struct NashFactory;

impl Factory for NashFactory {
    fn create_point_guard(&self) -> Box<dyn PointGuard> {
        Box::new(Nash)
    }
}

fn assist(factory: &dyn Factory) {
    let point_guard = factory.create_point_guard();
    point_guard.assist();
}

fn main() {
    assist(&PaulFactory);
    assist(&NashFactory);
}

```

现在增加一个新的控球后卫只需要增加新的后卫类以及对应的工厂类即可。但是如果我们想创建一个球队，这两种方式就都不太合适了，原因在于这两种方式的工厂类都是针对某一类产品的，我们需要一个可以创建多类产品的工厂，就这需要用到抽象工厂模式了。

# 抽象工厂模式

简单起见，这里假设一个球队只需要一个“控球后卫”和“中锋”即可，则实现方式如下：

```ts
interface PointGuard {
  assist(): void
}

class Paul implements PointGuard {
  assist(): void {
    console.log('Paul assist')
  }
}

class Nash implements PointGuard {
  assist(): void {
    console.log('Nash assist')
  }
}

interface CentreForward {
  slamDunk(): void
}

class ONeal implements CentreForward {
  slamDunk(): void {
    console.log('ONeal slam dunk')
  }
}

class YaoMing implements CentreForward {
  slamDunk(): void {
    console.log('YaoMing slam dunk')
  }
}

interface TeamFactory {
  createPointGuard(): PointGuard

  createCentreForward(): CentreForward
}

class RocketTeam implements TeamFactory {
  createCentreForward(): CentreForward {
    return new YaoMing()
  }

  createPointGuard(): PointGuard {
    return new Paul()
  }
}

class LakersTeam implements TeamFactory {
  createCentreForward(): CentreForward {
    return new ONeal()
  }

  createPointGuard(): PointGuard {
    return new Nash()
  }
}

function play(teamFactory: TeamFactory) {
  const centreForward = teamFactory.createCentreForward()
  const pointGuard = teamFactory.createPointGuard()
  pointGuard.assist()
  centreForward.slamDunk()
}

play(new RocketTeam())
play(new LakersTeam())
```

```rust
pub trait PointGuard {
    fn assist(&self);
}

pub struct Paul;

impl PointGuard for Paul {
    fn assist(&self) {
        println!("Paul assist");
    }
}

struct Nash;

impl PointGuard for Nash {
    fn assist(&self) {
        println!("Nash assist");
    }
}

pub trait CentreForward {
    fn slam_dunk(&self);
}

pub struct ONeal;

impl CentreForward for ONeal {
    fn slam_dunk(&self) {
        println!("ONeal slam dunk");
    }
}

struct YaoMing;

impl CentreForward for YaoMing {
    fn slam_dunk(&self) {
        println!("YaoMing slam dunk");
    }
}

pub trait TeamFactory {
    fn create_point_guard(&self) -> Box<dyn PointGuard>;
    fn create_centre_forward(&self) -> Box<dyn CentreForward>;
}

pub struct LakersFactory;

impl TeamFactory for LakersFactory {
    fn create_point_guard(&self) -> Box<dyn PointGuard> {
        Box::new(Paul)
    }

    fn create_centre_forward(&self) -> Box<dyn CentreForward> {
        Box::new(ONeal)
    }
}

pub struct RocketFactory;

impl TeamFactory for RocketFactory {
    fn create_point_guard(&self) -> Box<dyn PointGuard> {
        Box::new(Nash)
    }

    fn create_centre_forward(&self) -> Box<dyn CentreForward> {
        Box::new(YaoMing)
    }
}

fn play(team_factory: &dyn TeamFactory) {
    let point_guard = team_factory.create_point_guard();
    let centre_forward = team_factory.create_centre_forward();
    point_guard.assist();
    centre_forward.slam_dunk();
}

fn main() {
    play(&RocketFactory);
    play(&LakersFactory);
}
```

以上只是照本宣科地实现了一遍，实际情况中还是得灵活变通。
