---
title: 实现一个简单的比特币：Part 2 - 交易系统
date: 2025-12-31 11:34:15
tags:
  - bitcoin
categories:
  - web3
---

在上一篇文章中，我们实现了比特币的基础组件：密码学工具、钱包系统和 UTXO 模型。这些是比特币的基石，但要让比特币真正运转起来，我们还需要一个核心组件：交易系统。

今天我们将深入探讨如何实现一个完整的交易系统，包括交易的构建、签名、验证，以及最重要的 UTXO 选择和找零机制。

## 一、为什么需要交易系统

在传统的银行系统中，转账很简单：从 A 账户扣除一定金额，向 B 账户增加相同金额。但比特币采用的 UTXO 模型完全不同，它更像是现金交易。

想象一下现实生活中的场景：你钱包里有一张 100 元、一张 50 元和两张 20 元的纸币。现在你要买 60 元的东西，你会怎么做？你可能会：

1. 拿出 100 元纸币
2. 商家收取 60 元
3. 商家找零 40 元给你

这个过程中，你原来的 100 元纸币被"花掉"了，取而代之的是商家收到的 60 元和你收到的 40 元找零。

比特币的交易系统就是模拟这个过程。每笔交易都需要：

- 选择合适的 UTXO（纸币）
- 计算找零金额
- 对交易进行签名证明所有权
- 让网络验证交易的合法性

## 二、交易的基本结构

在开始实现之前，我们先理解交易的结构。一笔比特币交易由三个核心部分组成：

```
交易 (Transaction)
├── 交易 ID (txId)
├── 输入列表 (inputs)
│   ├── 输入1: 引用的 UTXO + 签名 + 公钥
│   ├── 输入2: 引用的 UTXO + 签名 + 公钥
│   └── ...
├── 输出列表 (outputs)
│   ├── 输出1: 金额 + 接收地址
│   ├── 输出2: 金额 + 接收地址
│   └── ...
└── 时间戳 (timestamp)
```

每个输入都指向一个之前存在的 UTXO，并提供签名来证明你有权花费它。每个输出创建新的 UTXO，可以在未来的交易中被花费。

让我们看一个具体例子。假设 Alice 有两个 UTXO：

**UTXO 集合（交易前）：**

| UTXO  | 金额    | 所有者 | 状态 |
| ----- | ------- | ------ | ---- |
| tx1:0 | 100 BTC | Alice  | 有效 |
| tx2:0 | 50 BTC  | Alice  | 有效 |

**Alice 想给 Bob 转账 60 BTC，创建新交易：**

交易输入：

| 引用 UTXO | 金额    | 签名         | 公钥         |
| --------- | ------- | ------------ | ------------ |
| tx1:0     | 100 BTC | Alice 的签名 | Alice 的公钥 |

交易输出：

| 输出索引 | 金额   | 接收地址     | 说明 |
| -------- | ------ | ------------ | ---- |
| 0        | 60 BTC | Bob 的地址   | 转账 |
| 1        | 40 BTC | Alice 的地址 | 找零 |

**交易完成后，UTXO 集合变成：**

| UTXO  | 金额    | 所有者 | 状态   | 说明         |
| ----- | ------- | ------ | ------ | ------------ |
| tx1:0 | 100 BTC | Alice  | 已花费 | 被新交易消耗 |
| tx2:0 | 50 BTC  | Alice  | 有效   | 未使用       |
| tx3:0 | 60 BTC  | Bob    | 有效   | 新创建       |
| tx3:1 | 40 BTC  | Alice  | 有效   | 找零         |

注意：Alice 原来的 `tx1:0` 被标记为"已花费"，不再存在于 UTXO 集合中。

## 三、Transaction 类：交易的核心

现在让我们实现 `Transaction` 类。这个类需要管理交易的输入、输出，计算交易 ID，并提供验证功能。

### 3.1 交易的创建

```typescript
export class Transaction {
  id: string
  inputs: TxInput[]
  outputs: TxOutput[]
  timestamp: number

  constructor(
    inputs: TxInput[],
    outputs: TxOutput[],
    timestamp: number = Date.now()
  ) {
    if (inputs.length === 0) {
      throw new Error('交易必须至少有一个输入')
    }
    if (outputs.length === 0) {
      throw new Error('交易必须至少有一个输出')
    }

    this.inputs = inputs
    this.outputs = outputs
    this.timestamp = timestamp
    this.id = this.calculateId()
  }
}
```

这里的关键点是：交易必须至少有一个输入和一个输出。没有输入意味着没有资金来源，没有输出意味着没有接收者。

### 3.2 交易 ID 的计算

交易 ID 是交易内容的哈希值，它唯一标识一笔交易。重要的是，交易 ID 的计算不应该包含签名，因为签名本身是对交易内容的 hash。如果把签名包含在内，就会形成循环依赖。

```typescript
private calculateId(): string {
  const content = this.getContentForSigning()
  return Hash.sha256(content)
}

getContentForSigning(): string {
  const inputsForSigning = this.inputs.map(input => ({
    txId: input.txId,
    outputIndex: input.outputIndex,
  }))

  const content = {
    inputs: inputsForSigning,
    outputs: this.outputs.map(output => output.toJSON()),
    timestamp: this.timestamp,
  }

  return JSON.stringify(content)
}
```

`getContentForSigning()` 方法返回的内容：

- 包含输入的引用信息（txId 和 outputIndex）
- 不包含签名和公钥
- 包含所有输出和时间戳

这样，无论签名如何变化，交易的内容始终是确定的，交易 ID 也保持不变。

### 3.3 金额验证

交易系统有一个基本的经济规则：输入总额必须大于或等于输出总额。差额就是矿工费。

```typescript
getInputAmount(utxoSet: Map<string, TxOutput>): number {
  let total = 0
  for (const input of this.inputs) {
    const key = `${input.txId}:${input.outputIndex}`
    const utxo = utxoSet.get(key)
    if (!utxo) {
      throw new Error(`UTXO 不存在: ${key}`)
    }
    total += utxo.amount
  }
  return total
}

getOutputAmount(): number {
  return this.outputs.reduce((sum, output) => sum + output.amount, 0)
}

calculateFee(utxoSet: Map<string, TxOutput>): number {
  const inputAmount = this.getInputAmount(utxoSet)
  const outputAmount = this.getOutputAmount()
  return inputAmount - outputAmount
}
```

让我们通过一个例子理解矿工费：

```
输入：
  UTXO1: 100 BTC
  UTXO2: 50 BTC
  总计: 150 BTC

输出：
  给 Bob: 60 BTC
  找零给自己: 89 BTC
  总计: 149 BTC

矿工费 = 150 - 149 = 1 BTC
```

这 1 BTC 的差额就是矿工费，奖励给将这笔交易打包进区块的矿工。

### 3.4 Coinbase 交易：特殊的第一笔交易

每个区块的第一笔交易是特殊的，它叫做 Coinbase 交易，是矿工的奖励。这笔交易没有真正的输入，因为它凭空创造了新的比特币。

```typescript
static createCoinbase(
  minerAddress: string,
  amount: number,
  blockHeight: number = 0
): Transaction {
  const coinbaseInput = new TxInput(
    '0000000000000000000000000000000000000000000000000000000000000000',
    blockHeight,
    '',
    ''
  )

  const coinbaseOutput = new TxOutput(amount, minerAddress)

  return new Transaction([coinbaseInput], [coinbaseOutput])
}

isCoinbase(): boolean {
  return (
    this.inputs.length === 1 &&
    this.inputs[0].txId === '0000000000000000000000000000000000000000000000000000000000000000'
  )
}
```

Coinbase 交易使用一个特殊的全零 txId 作为输入，表示这是新创造的比特币。在真实的比特币网络中，大约每 10 分钟就会产生一个新区块，矿工通过 Coinbase 交易获得区块奖励。

## 四、TransactionSigner：签名与验证

有了交易结构，我们需要一套机制来证明交易的合法性。这就是签名和验证的作用。

### 4.1 交易签名

签名交易就是用私钥对交易内容进行签名，证明你有权花费输入中引用的 UTXO。

```typescript
export class TransactionSigner {
  static signTransaction(
    transaction: Transaction,
    wallet: Wallet
  ): Transaction {
    const txData = transaction.getContentForSigning()

    for (const input of transaction.inputs) {
      if (input.isSigned()) {
        continue
      }

      const signature = wallet.sign(txData)
      input.setSignature(signature, wallet.publicKey)
    }

    transaction.id = transaction.calculateId()

    return transaction
  }
}
```

签名过程很直接：

1. 获取交易的原始内容（不包含签名）
2. 对每个未签名的输入进行签名
3. 将签名和公钥存储在输入中

让我们看一个实际的签名例子：

**原始交易（未签名）：**

```
输入：
  - txId: tx1
  - outputIndex: 0
  - signature: (空)
  - publicKey: (空)
```

**签名过程**
↓

**签名后的交易：**

```
输入：
  - txId: tx1
  - outputIndex: 0
  - signature: 3045...a7b9
  - publicKey: 04f3...c2d1
```

### 4.2 交易验证：两层防护

验证交易是确保网络安全的关键。验证过程包含两个层次：

**第一层：验证签名本身是否有效**

```typescript
const isSignatureValid = Signature.verify(txData, signature, publicKey)
```

这一步验证签名确实是由拥有对应私钥的人创建的。

**第二层：验证公钥是否拥有被引用的 UTXO**

```typescript
const sha256Hash = Hash.sha256(input.publicKey)
const ripemd160Hash = Hash.ripemd160(sha256Hash)
const addressFromPublicKey = encodeBase58(ripemd160Hash)

if (addressFromPublicKey !== utxo.address) {
  return false
}
```

只有两层验证都通过，交易才有效。即使 Bob 能创建有效的签名（第一层通过），如果他的公钥对应的地址不是 UTXO 的所有者，第二层验证就会失败。

让我们通过一个攻击场景来理解这两层防护的重要性：

**场景：Bob 试图盗取 Alice 的 UTXO**

```
Alice 的 UTXO: tx1:0 (100 BTC)
所有者地址: alice_address

Bob 创建一个欺诈交易：

输入：
  - txId: tx1 (Alice 的 UTXO)
  - outputIndex: 0
  - signature: Bob 用自己私钥签名
  - publicKey: Bob 的公钥

输出：
  - 100 BTC → Bob 的地址

验证过程：
[通过] 第一层：签名验证通过
        （Bob 的签名对 Bob 的公钥是有效的）

[失败] 第二层：所有权验证失败
        从 Bob 的公钥计算的地址: bob_address
        UTXO 的所有者地址: alice_address
        地址不匹配！
```

这两层防护确保了：

1. 交易确实是由持有私钥的人签名的（防止伪造签名）
2. 签名的人确实拥有被引用的 UTXO（防止盗用他人的 UTXO）

完整的验证代码：

```typescript
static verifyTransaction(
  transaction: Transaction,
  utxoSet: Map<string, {amount: number; address: string}>
): boolean {
  if (transaction.isCoinbase()) {
    return true
  }

  const txData = transaction.getContentForSigning()

  for (const input of transaction.inputs) {
    if (!input.isSigned()) {
      return false
    }

    // 第一层：验证签名
    if (!Signature.verify(txData, input.signature, input.publicKey)) {
      return false
    }

    // 第二层：验证所有权
    const utxoKey = `${input.txId}:${input.outputIndex}`
    const utxo = utxoSet.get(utxoKey)

    if (!utxo) {
      return false
    }

    const sha256Hash = Hash.sha256(input.publicKey)
    const ripemd160Hash = Hash.ripemd160(sha256Hash)
    const addressFromPublicKey = encodeBase58(ripemd160Hash)

    if (addressFromPublicKey !== utxo.address) {
      return false
    }
  }

  return true
}
```

## 五、TransactionBuilder：智能的交易构建器

手动构建交易很繁琐，需要选择 UTXO、计算找零、处理签名。`TransactionBuilder` 类封装了这些复杂性，提供了简洁的 API。

### 5.1 使用方式

让我们先看看如何使用 TransactionBuilder：

```typescript
// 简单转账
const tx = new TransactionBuilder(utxoSet)
  .from(aliceWallet)
  .to(bobWallet.address, 60)
  .buildAndSign()

// 多人转账
const tx = new TransactionBuilder(utxoSet)
  .from(aliceWallet)
  .to(bobWallet.address, 30)
  .to(charlieWallet.address, 20)
  .withChangeAddress(aliceWallet.address)
  .buildAndSign()

// 或使用静态方法
const tx = TransactionBuilder.createSimpleTransfer(
  aliceWallet,
  bobWallet.address,
  60,
  utxoSet
)
```

这种链式调用的 API 设计让代码既简洁又易读。

### 5.2 UTXO 选择策略：贪心算法

UTXO 选择是交易构建的核心问题。给定一个目标金额，如何从多个 UTXO 中选择最优的组合？

我们采用贪心算法：优先选择金额最大的 UTXO，直到满足需求。

```typescript
private selectUTXOs(
  utxos: Array<{txId: string; outputIndex: number; output: TxOutput}>,
  targetAmount: number
): Array<{txId: string; outputIndex: number; output: TxOutput}> {
  // 按金额从大到小排序
  const sorted = [...utxos].sort((a, b) => b.output.amount - a.output.amount)

  const selected: Array<{
    txId: string
    outputIndex: number
    output: TxOutput
  }> = []
  let total = 0

  for (const utxo of sorted) {
    selected.push(utxo)
    total += utxo.amount

    if (total >= targetAmount) {
      break
    }
  }

  if (total < targetAmount) {
    return []
  }

  return selected
}
```

让我们通过例子理解这个算法：

```
场景：Alice 需要支付 60 BTC

Alice 的 UTXO：
  UTXO1: 100 BTC
  UTXO2: 50 BTC
  UTXO3: 25 BTC
  UTXO4: 10 BTC

步骤 1：排序（从大到小）
  [100, 50, 25, 10]

步骤 2：选择
  - 选择 100 BTC
  - 累计：100 BTC
  - 100 >= 60，满足条件，停止

结果：选择 1 个 UTXO (100 BTC)
找零：100 - 60 = 40 BTC
```

如果需要支付 120 BTC：

```
步骤 1：排序
  [100, 50, 25, 10]

步骤 2：选择
  - 选择 100 BTC，累计：100
  - 100 < 120，继续
  - 选择 50 BTC，累计：150
  - 150 >= 120，满足条件，停止

结果：选择 2 个 UTXO (100 + 50 = 150 BTC)
找零：150 - 120 = 30 BTC
```

这个贪心算法的优点：

- 简单高效
- 通常能选择最少数量的 UTXO
- 减少交易大小（更少的输入意味着更小的交易体积）

### 5.3 完整流程

让我们通过一个完整的例子理解整个流程：

**初始状态：**

| UTXO  | 金额    | 所有者 |
| ----- | ------- | ------ |
| tx1:0 | 100 BTC | Alice  |
| tx2:0 | 50 BTC  | Alice  |
| tx3:0 | 25 BTC  | Alice  |

**目标：** Alice 给 Bob 转账 60 BTC

**步骤 1：选择 UTXO**

```
选择算法：贪心（从大到小）
选择：tx1:0 (100 BTC)
```

**步骤 2：构建输入**

```typescript
inputs = [
  TxInput(txId: 'tx1', outputIndex: 0)
]
```

**步骤 3：构建输出**

```typescript
recipients = [{address: 'bob_address', amount: 60}]

outputs = [TxOutput(60, 'bob_address')]
```

**步骤 4：计算找零**

```
totalInput = 100
totalOutput = 60
change = 100 - 60 = 40
```

**步骤 5：添加找零输出**

```typescript
outputs.push(TxOutput(40, 'alice_address'))
```

**步骤 6：创建交易**

```typescript
tx = new Transaction(inputs, outputs)
```

**步骤 7：签名交易**

```typescript
对每个输入签名
input.signature = sign(txData, alice_privateKey)
input.publicKey = alice_publicKey
```

**最终交易 (tx4)：**

| 项目           | 内容                                            |
| -------------- | ----------------------------------------------- |
| Transaction ID | tx4                                             |
| **输入**       |                                                 |
| - tx1:0        | signature: 已签名<br/>publicKey: Alice's PubKey |
| **输出**       |                                                 |
| - 输出 0       | 60 BTC → bob_address                            |
| - 输出 1       | 40 BTC → alice_address                          |

执行这笔交易后，UTXO 集合的变化：

| UTXO  | 金额    | 所有者 | 状态   | 说明        |
| ----- | ------- | ------ | ------ | ----------- |
| tx1:0 | 100 BTC | Alice  | 已花费 | 被 tx4 消耗 |
| tx2:0 | 50 BTC  | Alice  | 有效   | 未使用      |
| tx3:0 | 25 BTC  | Alice  | 有效   | 未使用      |
| tx4:0 | 60 BTC  | Bob    | 有效   | 新创建      |
| tx4:1 | 40 BTC  | Alice  | 有效   | 找零        |

**最终余额：**

- Alice: tx2:0 (50) + tx3:0 (25) + tx4:1 (40) = **115 BTC**
- Bob: tx4:0 (60) = **60 BTC**

## 六、总结

在这篇文章中，我们实现了比特币的交易系统。我们学习了如何构建交易，包括选择 UTXO、计算找零和生成交易 ID。我们探讨了交易签名的两层验证机制：验证签名本身的有效性，以及验证签名者是否真正拥有被引用的 UTXO。我们还实现了 TransactionBuilder，它封装了 UTXO 选择和找零计算的复杂性，提供了简洁的链式 API。

这些组件构成了比特币价值转移的核心。有了它们，我们可以创建交易、签名交易、验证交易。Transaction 类管理交易的数据结构，TransactionSigner 负责安全性，TransactionBuilder 提供易用性。三个类各司其职，共同构建了一个健壮的交易系统。
