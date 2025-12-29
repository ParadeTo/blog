---
title: 实现一个简单的比特币：Part 1 - 基础组件
date: 2025-12-26 10:00:25
tags:
  - bitcoin
categories:
  - web3
---

当我们听到比特币这个词的时候，脑海中浮现的可能是价格波动、挖矿、区块链等概念。但如果我们真的想理解比特币的本质，最好的方式就是自己动手实现一个简化版本。在这个系列的第一篇文章中，我们将从最基础的部分开始，逐步构建起比特币系统的核心组件。

## 从一个问题开始

在传统的银行系统中，所有的交易记录都保存在银行的中心服务器上。如果 Alice 想给 Bob 转账 100 元，银行会在自己的数据库中给 Alice 的账户减去 100 元，给 Bob 的账户加上 100 元。这个过程看起来很简单，但它依赖于一个前提：我们必须信任银行。

比特币的创新之处在于，它试图在没有中心化机构的情况下，让一群互不信任的人能够安全地进行转账。要实现这个目标，我们需要解决几个关键问题：如何证明一笔钱确实属于你？如何防止你把同一笔钱花两次？如何让所有人对账本达成共识？

在这篇文章中，我们先聚焦于第一个问题：如何证明所有权。

## 密码学基础：数字签名

比特币使用椭圆曲线数字签名算法（ECDSA）来证明交易的所有权。核心原理是一对密钥：

- **私钥**：256 位随机数，只有所有者知道，用于签名
- **公钥**：从私钥通过椭圆曲线运算得到，可以公开，用于验证签名

数字签名的特性：

- 用私钥签名很容易
- 用公钥验证签名很容易
- 从签名或公钥反推私钥几乎不可能
- 没有私钥就无法伪造签名

**签名和验证流程：**

```
Alice 签名                    Bob/矿工 验证
─────────────────            ─────────────────
消息 "转账 50 BTC"           收到: 消息 + 签名 + Alice公钥
    ↓                             ↓
计算哈希 hash(消息)           计算哈希 hash(消息)
    ↓                             ↓
用私钥签名                     用公钥验证
sign(hash, 私钥)              verify(hash, 签名, 公钥)
    ↓                             ↓
广播: 消息 + 签名 + 公钥      验证通过
```

**代码实现：**

```typescript
export class KeyPair {
  private _privateKey: string
  private _publicKey: string

  constructor(privateKey?: string) {
    if (privateKey) {
      this._privateKey = privateKey
      this._publicKey = Signature.getPublicKeyFromPrivate(privateKey)
    } else {
      const {privateKey: privKey, publicKey: pubKey} =
        Signature.generateKeyPair()
      this._privateKey = privKey
      this._publicKey = pubKey
    }
  }

  sign(data: string): string {
    return Signature.sign(data, this._privateKey)
  }

  verify(data: string, signature: string): boolean {
    return Signature.verify(data, signature, this._publicKey)
  }
}
```

在实际交易中，发送者用私钥签名，验证者（矿工/节点）使用交易中附带的公钥来验证签名的有效性。

## 从公钥到地址

有了密钥对之后，下一个问题是：我们要把钱转给谁？在比特币中，我们不是直接用公钥来接收比特币，而是用一个叫做"地址"的东西。地址是从公钥经过一系列哈希运算和编码得到的一串字符。

为什么要这么做呢？有几个原因。首先，公钥比较长，不方便使用和记忆。其次，通过哈希运算，我们可以给公钥增加一层额外的安全保护。最后，经过特殊的编码（Base58 编码），我们可以让地址更容易辨认，避免混淆相似的字符。

地址的生成过程是这样的：首先对公钥进行 SHA-256 哈希，然后对结果再进行 RIPEMD-160 哈希，最后用 Base58 编码。这样得到的地址通常以数字 1 开头，长度在 26 到 35 个字符之间。

```typescript
private generateAddress(): string {
  const sha256Hash = Hash.sha256(this.keyPair.publicKey)
  const ripemd160Hash = Hash.ripemd160(sha256Hash)
  const address = encodeBase58(ripemd160Hash)
  return address
}
```

这个过程看起来有些复杂，但每一步都有其意义。SHA-256 提供了强大的抗碰撞特性，RIPEMD-160 将结果压缩到更短的长度，而 Base58 编码则让地址对人类更友好。Base58 编码去除了容易混淆的字符，比如数字 0 和字母 O，数字 1 和字母 I。

## UTXO：一种不同的记账方式

在解释了如何证明身份之后，我们需要思考另一个问题：如何记录谁有多少比特币？

传统的银行系统使用账户模型，每个账户有一个余额。比如 Alice 的账户显示有 500 元，Bob 的账户显示有 300 元。当 Alice 给 Bob 转账 100 元时，系统会更新两个账户的余额。

比特币采用了一种完全不同的方式，叫做 UTXO 模型。UTXO 是 "Unspent Transaction Output" 的缩写，意思是"未花费的交易输出"。这个名字听起来有些拗口，但它的概念其实很直观。

让我们对比一下两种模型：

**账户模型（传统银行）：**

| 账户名 | 交易前余额 | 交易后余额 | 说明              |
| ------ | ---------- | ---------- | ----------------- |
| Alice  | 500 元     | 400 元     | 直接修改余额 -100 |
| Bob    | 300 元     | 400 元     | 直接修改余额 +100 |

**UTXO 模型（比特币）：**

交易前：

| UTXO ID | 金额   | 所有者 | 状态 |
| ------- | ------ | ------ | ---- |
| UTXO_1  | 300 元 | Alice  | 有效 |
| UTXO_2  | 200 元 | Alice  | 有效 |
| UTXO_3  | 300 元 | Bob    | 有效 |

- Alice 实际余额：300 + 200 = **500 元**
- Bob 实际余额：300 = **300 元**

Alice 转给 Bob 100 元后：

| UTXO ID | 金额   | 所有者 | 状态   | 说明       |
| ------- | ------ | ------ | ------ | ---------- |
| UTXO_1  | 300 元 | Alice  | 已花费 | 被交易消耗 |
| UTXO_2  | 200 元 | Alice  | 有效   | 未使用     |
| UTXO_3  | 300 元 | Bob    | 有效   | 未使用     |
| UTXO_4  | 100 元 | Bob    | 有效   | 新创建     |
| UTXO_5  | 200 元 | Alice  | 有效   | 找零       |

- Alice 实际余额：200 + 200 = **400 元**
- Bob 实际余额：300 + 100 = **400 元**

我们可以把 UTXO 想象成一张张不同面额的纸币。假设 Alice 想给 Bob 转账 100 元，她手里有一张 150 元的"纸币"（一个 UTXO）。她不能直接撕掉一部分给 Bob，而是要把整张 150 元的纸币花掉，然后创建两张新的纸币：一张 100 元的给 Bob，一张 50 元的找零给自己。

让我们看一个完整的例子：

**初始状态：**

| UTXO   | 金额    | 所有者 | 状态 |
| ------ | ------- | ------ | ---- |
| TX_0:0 | 150 BTC | Alice  | 有效 |
| TX_1:0 | 200 BTC | Carol  | 有效 |

**Alice 创建交易 TX_2：**

交易输入：

| 输入索引 | 引用 UTXO | 金额    | 签名       | 公钥       |
| -------- | --------- | ------- | ---------- | ---------- |
| 0        | TX_0:0    | 150 BTC | Alice 签名 | Alice 公钥 |

交易输出：

| 输出索引 | 金额    | 接收地址   | 说明 |
| -------- | ------- | ---------- | ---- |
| 0        | 100 BTC | Bob 地址   | 转账 |
| 1        | 50 BTC  | Alice 地址 | 找零 |

- 输入总额：150 BTC
- 输出总额：150 BTC
- 矿工费：0 BTC
- 验证者使用 Alice 公钥 来验证 Alice 签名 的有效性

**交易确认后的状态：**

| UTXO   | 金额    | 所有者 | 状态   | 说明         |
| ------ | ------- | ------ | ------ | ------------ |
| TX_0:0 | 150 BTC | Alice  | 已花费 | 被 TX_2 消耗 |
| TX_1:0 | 200 BTC | Carol  | 有效   | 未使用       |
| TX_2:0 | 100 BTC | Bob    | 有效   | 新创建       |
| TX_2:1 | 50 BTC  | Alice  | 有效   | 找零         |

**余额汇总：**

- Alice：50 BTC (TX_2:1)
- Bob：100 BTC (TX_2:0)
- Carol：200 BTC (TX_1:0)

这种模型有几个优势。首先，每个 UTXO 只能被花费一次，这让双花检测变得很简单：系统只需要检查一个 UTXO 是否已经被使用过。其次，不同的 UTXO 之间是相互独立的，这意味着系统可以并行处理多笔交易，只要它们不涉及相同的 UTXO。最后，UTXO 模型天然地提供了更好的隐私保护，因为每次交易都可以使用新的地址。

## 交易的结构

在 UTXO 模型中，每笔交易都包含两个主要部分：输入和输出。输入指向之前的 UTXO，证明你有权花费它们。输出创建新的 UTXO，指定金额和接收地址。

交易输入需要包含几个关键信息：引用的交易 ID、输出索引、签名和公钥。交易 ID 和输出索引用来定位具体的 UTXO。签名用来证明你确实有权花费这个 UTXO。公钥则让其他人（矿工和节点）可以验证你的签名是否有效。

验证过程是这样的：系统会用输入中提供的公钥，结合引用的 UTXO 的接收地址，来验证两件事：第一，这个公钥对应的地址确实是 UTXO 的接收地址；第二，签名确实是用这个公钥对应的私钥生成的。只有两个条件都满足，这个输入才是有效的。

需要说明的是，真实的比特币使用了更复杂的脚本系统（Script）。在真实比特币中，签名和公钥被包含在 `scriptSig`（解锁脚本）字段中，而不是像我们这样直接存储。比特币的脚本系统是一个基于栈的语言，提供了更大的灵活性，可以实现多签名、时间锁等高级功能。我们这里为了简化，直接存储签名和公钥，这样更容易理解核心概念。

```typescript
export class TxInput {
  constructor(
    public readonly txId: string,
    public readonly outputIndex: number,
    public signature: string = '',
    public publicKey: string = ''
  ) {
    if (!txId || txId.trim().length === 0) {
      throw new Error('交易 ID 不能为空')
    }
    if (outputIndex < 0) {
      throw new Error('输出索引不能为负数')
    }
  }

  getUTXOKey(): string {
    return `${this.txId}:${this.outputIndex}`
  }
}
```

这个类的设计很简洁。每个输入都明确指向一个 UTXO，通过交易 ID 和输出索引来定位。签名和公钥在创建输入时可能还不存在，因为需要先构建完整的交易内容才能签名，所以它们有默认的空值。

交易输出的结构更加简单，只需要两个字段：金额和接收地址。金额必须大于零，地址不能为空。这些基本的验证规则在构造函数中就被强制执行了。

```typescript
export class TxOutput {
  constructor(public readonly amount: number, public readonly address: string) {
    if (amount <= 0) {
      throw new Error('输出金额必须大于 0')
    }
    if (!address || address.trim().length === 0) {
      throw new Error('接收地址不能为空')
    }
  }
}
```

一笔完整的交易可能有多个输入和多个输出。所有输入的总金额必须大于或等于所有输出的总金额。如果有差额，这个差额就成为矿工费，奖励给打包这笔交易的矿工。

让我们看一个更复杂的例子，Alice 有多个 UTXO，想给 Bob 转账 180 BTC：

**Alice 的 UTXO：**

| UTXO   | 金额    | 所有者 |
| ------ | ------- | ------ |
| TX_A:0 | 100 BTC | Alice  |
| TX_B:0 | 50 BTC  | Alice  |
| TX_C:0 | 60 BTC  | Alice  |

**Alice 想转给 Bob 180 BTC，创建新交易 TX_D：**

交易输入：

| 输入索引 | 引用 UTXO | 金额    | 签名       | 公钥       |
| -------- | --------- | ------- | ---------- | ---------- |
| 0        | TX_A:0    | 100 BTC | Alice 签名 | Alice 公钥 |
| 1        | TX_B:0    | 50 BTC  | Alice 签名 | Alice 公钥 |
| 2        | TX_C:0    | 60 BTC  | Alice 签名 | Alice 公钥 |

交易输出：

| 输出索引 | 金额    | 接收地址 | 说明 |
| -------- | ------- | -------- | ---- |
| 0        | 180 BTC | Bob      | 转账 |
| 1        | 27 BTC  | Alice    | 找零 |

**交易汇总：**

| 项目     | 金额    |
| -------- | ------- |
| 输入总额 | 210 BTC |
| 输出总额 | 207 BTC |
| 矿工费   | 3 BTC   |

**交易验证：**

- 所有输入的 UTXO 都存在
- 所有签名都有效（每个输入都包含签名和公钥用于验证）
- 输入总额 (210) ≥ 输出总额 (207)
- 矿工费 = 210 - 207 = 3 BTC

在这个例子中，Alice 使用了三个 UTXO 作为输入，总共 210 BTC。她创建了两个输出：180 BTC 给 Bob，27 BTC 找零给自己。剩余的 3 BTC 成为矿工费。

## UTXO 集合的管理

系统需要一个地方来存储所有当前有效的 UTXO。这就是 UTXO 集合的作用。每当有新的交易被确认，系统会从 UTXO 集合中移除被花费的 UTXO，同时添加新创建的 UTXO。

UTXO 集合使用一个 Map 数据结构来存储，键是由交易 ID 和输出索引组成的字符串，值是交易输出本身。这种设计让查找操作的时间复杂度是 O(1)，非常高效。

```typescript
export class UTXOSet {
  private utxos: Map<string, TxOutput>

  add(txId: string, outputIndex: number, output: TxOutput): void {
    const key = this.makeKey(txId, outputIndex)
    this.utxos.set(key, output)
  }

  remove(txId: string, outputIndex: number): boolean {
    const key = this.makeKey(txId, outputIndex)
    return this.utxos.delete(key)
  }

  private makeKey(txId: string, outputIndex: number): string {
    return `${txId}:${outputIndex}`
  }
}
```

UTXO 集合还提供了一些实用的方法。比如查询某个地址有哪些 UTXO，计算某个地址的总余额。这些操作都需要遍历整个 UTXO 集合，但因为使用了高效的数据结构，即使有大量的 UTXO，性能也能保持在可接受的范围内。

获取某个地址的所有 UTXO 是构建交易时的关键操作。当 Alice 想给 Bob 转账时，系统需要找出 Alice 拥有的所有 UTXO，然后选择足够的 UTXO 来满足转账金额。

```typescript
getUTXOsByAddress(address: string): Array<{
  txId: string
  outputIndex: number
  output: TxOutput
}> {
  const result: Array<{
    txId: string
    outputIndex: number
    output: TxOutput
  }> = []

  for (const [key, output] of this.utxos.entries()) {
    if (output.address === address) {
      const [txId, outputIndex] = this.parseKey(key)
      result.push({ txId, outputIndex, output })
    }
  }

  return result
}
```

这个方法遍历所有 UTXO，找出属于指定地址的那些。返回的结果不仅包含 UTXO 本身，还包含了它的位置信息（交易 ID 和输出索引），这样就可以在构建交易输入时直接使用。

让我们通过一个完整的例子来看 UTXO 集合的状态变化：

```typescript
// 初始化 UTXO 集合
const utxoSet = new UTXOSet()

// 创世交易：给 Alice 100 BTC
utxoSet.add('tx0', 0, new TxOutput(100, 'Alice地址'))

console.log('Alice 余额:', utxoSet.getBalance('Alice地址'))
// 输出: 100

// Alice 转给 Bob 60 BTC
// 交易 tx1 的输入引用 tx0:0，输出是 60 给 Bob，40 找零给 Alice
utxoSet.remove('tx0', 0) // 花费旧的 UTXO
utxoSet.add('tx1', 0, new TxOutput(60, 'Bob地址')) // Bob 收到
utxoSet.add('tx1', 1, new TxOutput(40, 'Alice地址')) // Alice 找零

console.log('Alice 余额:', utxoSet.getBalance('Alice地址')) // 40
console.log('Bob 余额:', utxoSet.getBalance('Bob地址')) // 60

// 查看 Alice 拥有的 UTXO
const aliceUTXOs = utxoSet.getUTXOsByAddress('Alice地址')
console.log('Alice 的 UTXO:', aliceUTXOs)
// 输出: [{ txId: 'tx1', outputIndex: 1, output: { amount: 40, address: 'Alice地址' }}]
```

这个例子展示了 UTXO 集合如何随着交易的进行而动态更新。每笔交易都会消费一些 UTXO，同时创建新的 UTXO，整个系统通过这种方式追踪每个人的余额。

## 哈希：数字世界的指纹

哈希函数是比特币的核心组件之一。它的特点是：

- **固定长度输出**：无论输入多大，输出长度固定
- **单向不可逆**：无法从哈希值反推原始数据
- **雪崩效应**：输入微小变化，输出完全不同

**代码实现：**

```typescript
export class Hash {
  static sha256(data: string): string {
    return CryptoJS.SHA256(data).toString()
  }

  static doubleSha256(data: string): string {
    const firstHash = this.sha256(data)
    return this.sha256(firstHash)
  }

  static ripemd160(data: string): string {
    return CryptoJS.RIPEMD160(data).toString()
  }
}
```

## 钱包：把所有东西整合在一起

有了前面这些基础组件，我们就可以构建钱包了。钱包是用户与比特币系统交互的主要接口。一个钱包包含了密钥对，可以生成地址，对交易进行签名。

```typescript
export class Wallet {
  private keyPair: KeyPair
  private _address: string

  constructor(privateKey?: string) {
    this.keyPair = new KeyPair(privateKey)
    this._address = this.generateAddress()
  }

  get publicKey(): string {
    return this.keyPair.publicKey
  }

  get address(): string {
    return this._address
  }

  sign(data: string): string {
    return this.keyPair.sign(data)
  }
}
```

创建钱包的过程很简单。如果提供了私钥，钱包会从这个私钥恢复；如果没有提供，就生成一个新的密钥对。无论哪种方式，钱包都会计算出对应的地址。

钱包提供了签名方法，这是创建交易的关键步骤。当用户想要花费某个 UTXO 时，他需要用自己的私钥对交易进行签名，证明他确实有权使用这个 UTXO。其他人可以用交易中提供的公钥来验证这个签名。

钱包还提供了导出和导入功能。用户可以备份自己的私钥，然后在另一个地方用这个私钥恢复钱包。这个功能极其重要，因为如果私钥丢失了，对应地址上的所有比特币也就永远丢失了。

下面是一个完整的钱包使用示例：

```typescript
// 1. 创建钱包
const alice = new Wallet()
const bob = new Wallet()

console.log('Alice 的地址:', alice.address)
// 输出: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
console.log('Bob 的地址:', bob.address)

// 2. Alice 对交易消息进行签名
const message = 'Transfer 50 BTC to Bob'
const signature = alice.sign(message)
console.log('Alice 的签名:', signature)
// 输出: 304502210089ab3c...

// 3. Alice 将消息、签名和公钥一起发送
const transaction = {
  message: message,
  signature: signature,
  publicKey: alice.publicKey, // 其他人需要这个来验证
}

// 4. Bob（或任何人）验证签名
// 注意：实际场景中，验证者需要用签名者的公钥来验证
// 这里我们用 Signature.verify() 而不是 wallet.verify()
import {Signature} from './crypto/signature'

const isValid = Signature.verify(
  transaction.message,
  transaction.signature,
  transaction.publicKey // 使用 Alice 的公钥
)
console.log('签名是否有效:', isValid) // true

// 5. Alice 也可以自己验证（用于测试）
const selfVerify = alice.verify(message, signature)
console.log('自验证:', selfVerify) // true

// 6. 导出钱包信息（谨慎处理！包含私钥）
const walletData = alice.export()
console.log('钱包信息:', walletData)
// {
//   privateKey: 'e9873d...',
//   publicKey: '04a34b...',
//   address: '1A1zP1...'
// }

// 7. 从私钥恢复钱包
const recovered = Wallet.fromPrivateKey(walletData.privateKey)
console.log('恢复的地址:', recovered.address) // 与原地址相同
```

整个系统的工作流程可以这样理解：

**比特币系统工作流程：**

```
1. 创建钱包
   Wallet() → 生成密钥对 → 生成地址

2. 获得比特币
   接收转账 → 新的 UTXO 被创建 → 加入 UTXO 集合

3. 发起转账
   选择 UTXO → 构建交易 → 签名交易 → 广播到网络

4. 交易确认
   矿工打包交易 → 工作量证明 → 添加到区块链

5. 更新状态
   旧 UTXO 标记为已花费 → 新 UTXO 加入集合
```

## 小结

本文实现了比特币系统的基础层，包括：

**核心组件：**

- **密钥对与签名**
- **地址生成**
- **UTXO 模型**：未花费交易输出的独特记账方式
- **交易结构**：输入（引用 UTXO + 签名）+ 输出（金额 + 地址）
- **UTXO 集合**：高效管理所有有效的未花费输出
- **钱包**：密钥管理、地址生成、交易签名

**已具备的能力：**
创建钱包 → 生成地址 → 构建交易 → 签名验证

在 Part 2 中，我们将实现区块链、工作量证明（挖矿）和共识机制。

比特币的设计优雅地融合了密码学、数据结构和经济激励，创造出去中心化的电子现金系统。通过动手实现，我们不仅理解了原理，也体会到了设计的精妙。
