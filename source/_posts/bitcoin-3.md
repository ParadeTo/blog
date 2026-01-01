---
title: 实现一个简单的比特币：Part 3 - 区块链与挖矿
date: 2026-01-01 17:54:40
tags:
  - bitcoin
categories:
  - web3
---

在前两篇文章中，我们实现了比特币的基础组件：密码学工具、钱包系统、UTXO 模型和交易系统。现在我们来到了比特币最核心的部分：区块链和挖矿。

今天我们将深入探讨如何实现区块链的存储结构、Merkle 树、工作量证明算法，以及矿工如何打包交易并通过挖矿获得奖励。

## 一、为什么需要区块链

在前面的文章中，我们解决了如何证明所有权（数字签名）和如何记录交易（UTXO 模型）。但还有一个关键问题没有解决：谁来维护这个账本？如何确保账本不被篡改？

在传统系统中，银行维护账本，我们信任银行不会作恶。但在比特币的去中心化世界里，没有一个可信的中心机构。我们需要一种机制，让所有参与者都能维护同一份账本，并且这份账本一旦写入就很难被修改。

区块链就是这样一种数据结构。它将交易打包成区块，每个区块包含前一个区块的哈希值，形成一条链。要修改历史记录，攻击者需要重新计算被修改区块之后的所有区块，这在计算上是极其困难的。

但这里有个问题：一个区块可能包含成百上千笔交易。如果我们想验证某笔交易是否在区块中，难道要下载所有交易数据吗？对于轻量级客户端（如手机钱包）来说，这显然不现实。

比特币的解决方案是 **Merkle 树**。它让区块头只需存储一个 32 字节的 Merkle 根，就能代表整个交易集合。验证者只需要少量的哈希值（Merkle 证明），就能证明某笔交易确实在区块中，而无需下载全部交易。这种设计使得轻量级客户端成为可能。

## 二、Merkle 树：高效验证的基石

让我们详细了解 Merkle 树的工作原理，以及它如何为区块链提供高效验证能力。

### 2.1 什么是 Merkle 树

Merkle 树是一种二叉树，叶子节点是数据的哈希值，非叶子节点是其子节点哈希值的哈希。最终树根（Merkle 根）是整个数据集的唯一指纹。

让我们看一个例子：

**构建 Merkle 树：**

```
交易列表: [tx1, tx2, tx3, tx4]

第一层（叶子节点）：
Hash(tx1)  Hash(tx2)  Hash(tx3)  Hash(tx4)
   H1         H2         H3         H4

第二层：
     H12 = Hash(H1 + H2)    H34 = Hash(H3 + H4)

第三层（根）：
          Root = Hash(H12 + H34)
```

Merkle 树有什么用？假设你想验证 tx1 是否在区块中，你不需要下载所有交易，只需要：

**Merkle 证明：**

| 需要的数据 | 说明                      |
| ---------- | ------------------------- |
| tx1        | 要验证的交易              |
| H2         | tx1 的兄弟节点            |
| H34        | 父节点的兄弟节点          |
| Root       | Merkle 根（区块头中已有） |

验证步骤：

```
1. 计算 H1 = Hash(tx1)
2. 计算 H12 = Hash(H1 + H2)
3. 计算 Root' = Hash(H12 + H34)
4. 比较 Root' 是否等于 Root
```

如果相等，就证明 tx1 确实在区块中。对于有 1000 笔交易的区块，Merkle 证明只需要大约 10 个哈希值，而不是全部 1000 笔交易。

### 2.2 实现 Merkle 树

我们使用纯指针式（对象引用）实现 Merkle 树，通过节点间的引用关系构建真正的树形结构：

```typescript
export interface MerkleNode {
  hash: string
  left?: MerkleNode // 左子节点引用
  right?: MerkleNode // 右子节点引用
}

export class MerkleTree {
  private root: MerkleNode | null = null
  private leaves: string[] = []

  constructor(data: string[]) {
    if (data.length === 0) {
      throw new Error('Merkle 树至少需要一个数据元素')
    }

    // 对每个数据计算哈希
    this.leaves = data.map((item) => Hash.sha256(item))
    // 构建树
    this.root = this.buildTree(this.leaves)
  }

  private buildTree(hashes: string[]): MerkleNode {
    // 创建叶子节点（每个哈希对应一个节点对象）
    const leafNodes: MerkleNode[] = hashes.map((hash) => ({hash}))

    // 递归构建树
    return this.buildTreeFromNodes(leafNodes)
  }

  private buildTreeFromNodes(nodes: MerkleNode[]): MerkleNode {
    // 如果只有一个节点，它就是根节点
    if (nodes.length === 1) {
      return nodes[0]
    }

    const parentNodes: MerkleNode[] = []

    // 两两配对构建父节点
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i]
      const right = i + 1 < nodes.length ? nodes[i + 1] : nodes[i]

      const parent: MerkleNode = {
        hash: Hash.sha256(left.hash + right.hash),
        left, // 保存左子节点引用
        right, // 保存右子节点引用
      }

      parentNodes.push(parent)
    }

    // 递归构建上层（传入节点对象，而不是哈希值）
    return this.buildTreeFromNodes(parentNodes)
  }

  getRoot(): string {
    if (!this.root) {
      throw new Error('Merkle 树未构建')
    }
    return this.root.hash
  }
}
```

关键点：

- **递归传递节点**：`buildTreeFromNodes` 接收节点数组并递归构建，保持节点间的引用关系
- **奇数处理**：如果数据个数是奇数，最后一个节点会自我配对
- **时间复杂度**：O(n)，其中 n 是数据个数

## 三、区块结构：链接的基石

区块是区块链的基本单元。每个区块包含两部分：区块头和区块体。

### 3.1 区块头

区块头包含区块的元数据，是工作量证明的对象：

| 字段         | 说明       | 作用                 |
| ------------ | ---------- | -------------------- |
| index        | 区块高度   | 标识区块在链中的位置 |
| previousHash | 前区块哈希 | 将区块链接成链       |
| timestamp    | 时间戳     | 记录区块创建时间     |
| merkleRoot   | Merkle 根  | 所有交易的指纹       |
| difficulty   | 难度       | 挖矿目标难度         |
| nonce        | 随机数     | 工作量证明的变量     |

### 3.2 区块体

区块体包含交易列表。第一笔交易必须是 Coinbase 交易（矿工奖励），其余是普通交易。

### 3.3 区块哈希

区块的哈希值是对区块头进行双重 SHA-256 计算得到的：

```typescript
calculateHash(): string {
  const blockHeader = JSON.stringify({
    index: this.index,
    previousHash: this.previousHash,
    timestamp: this.timestamp,
    merkleRoot: this.merkleRoot,
    difficulty: this.difficulty,
    nonce: this.nonce,
  })
  return Hash.doubleSha256(blockHeader)
}
```

注意：区块哈希不包含交易内容，只包含 Merkle 根。这意味着即使交易数据很大，哈希计算也很快。

### 3.4 创世区块

区块链的第一个区块叫创世区块，它没有前区块：

```typescript
static createGenesisBlock(coinbaseTx: Transaction): Block {
  return new Block(
    0,                    // 索引为 0
    '0',                  // 前区块哈希为 '0'
    Date.now(),
    [coinbaseTx],
    1                     // 初始难度
  )
}
```

## 四、工作量证明：挖矿的核心

工作量证明（Proof of Work, PoW）是比特币的共识机制。它要求矿工找到一个 nonce 值，使得区块哈希满足难度要求。

### 4.1 难度目标

难度用前导零的个数表示。例如，难度为 4 意味着区块哈希必须以 4 个零开头：

```
难度 1: 0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
难度 2: 00xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
难度 3: 000xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
难度 4: 0000xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

难度每增加 1，平均需要的尝试次数增加 16 倍。

### 4.2 挖矿过程

挖矿就是不断尝试不同的 nonce 值，直到找到满足难度的哈希：

```typescript
static mine(block: Block): MiningResult {
  const startTime = Date.now()
  let nonce = 0
  let hash: string
  const target = '0'.repeat(block.difficulty)

  while (true) {
    block.setNonce(nonce)
    hash = block.hash

    if (hash.startsWith(target)) {
      const endTime = Date.now()
      const duration = endTime - startTime
      const hashRate = Math.floor((nonce / duration) * 1000)

      return {
        nonce,
        hash,
        attempts: nonce,
        duration,
        hashRate,
      }
    }

    nonce++
  }
}
```

让我们看一个实际的挖矿例子：

**挖矿示例（难度 = 3）：**

```
尝试 nonce = 0:
  区块哈希: 8a3b4c5d...
  不满足条件（没有以 000 开头）

尝试 nonce = 1:
  区块哈希: 2f9e1a7b...
  不满足条件

...

尝试 nonce = 4832:
  区块哈希: 000a1b2c3d4e5f...
  满足条件！找到有效区块！
```

这个过程看起来很简单，但实际上：

- 难度 1：平均需要尝试 16 次
- 难度 2：平均需要尝试 256 次
- 难度 3：平均需要尝试 4,096 次
- 难度 4：平均需要尝试 65,536 次

在真实的比特币网络中，难度远远大于这个数字，可能需要尝试数万亿次才能找到有效区块。

工作量证明的巧妙之处在于它 **验证容易，计算困难**，这意味着任何人都能快速验证区块的有效性，但要创建有效区块需要投入大量计算资源
。修改历史记录需要重新挖掘所有后续区块，成本极高

## 五、区块链管理：维护账本

有了区块和工作量证明，我们需要一个类来管理整条区块链。

### 5.1 区块链的核心功能

```typescript
export class Blockchain {
  private chain: Block[] = []
  private utxoSet: UTXOSet
  private config: BlockchainConfig

  // 添加新区块
  addBlock(block: Block): boolean {
    if (!this.isValidNewBlock(block, this.getLatestBlock())) {
      return false
    }

    this.chain.push(block)
    this.updateUTXOSet(block)
    return true
  }
}
```

### 5.2 区块验证

添加区块前需要进行多项检查：

**区块验证检查项：**

| 检查项         | 说明                                           | 重要性             |
| -------------- | ---------------------------------------------- | ------------------ |
| 索引连续       | `newBlock.index = previousBlock.index + 1`     | 确保链的连续性     |
| 前区块哈希匹配 | `newBlock.previousHash = previousBlock.hash`   | 确保链的完整性     |
| 工作量证明     | `hash.startsWith('0'.repeat(difficulty))`      | 确保付出了计算成本 |
| 时间戳合理     | `newBlock.timestamp > previousBlock.timestamp` | 防止时间倒退       |
| 交易有效       | 所有交易都通过验证                             | 确保交易合法性     |

```typescript
private isValidNewBlock(newBlock: Block, previousBlock: Block): boolean {
  // 检查索引
  if (newBlock.index !== previousBlock.index + 1) {
    return false
  }

  // 检查前区块哈希
  if (newBlock.previousHash !== previousBlock.hash) {
    return false
  }

  // 检查工作量证明
  if (!ProofOfWork.verify(newBlock)) {
    return false
  }

  // 检查时间戳
  if (newBlock.timestamp <= previousBlock.timestamp) {
    return false
  }

  // 验证所有交易
  for (const tx of newBlock.transactions) {
    // Coinbase 交易跳过 UTXO 验证
    if (tx.isCoinbase()) {
      continue
    }

    // 验证交易的 UTXO 是否存在
    if (!this.isValidTransaction(tx)) {
      return false
    }
  }

  return true
}

private isValidTransaction(tx: Transaction): boolean {
  // 检查所有输入引用的 UTXO 是否存在
  for (const input of tx.inputs) {
    if (!this.utxoSet.has(input.txId, input.outputIndex)) {
      return false
    }
  }
  return true
}
```

### 5.3 难度调整

为了保持稳定的出块时间，区块链需要定期调整挖矿难度。我们的实现每 10 个区块调整一次：

```typescript
calculateNextDifficulty(): number {
  const latestBlock = this.getLatestBlock()

  // 未到调整间隔，保持当前难度
  if ((latestBlock.index + 1) % this.config.difficultyAdjustmentInterval !== 0) {
    return latestBlock.difficulty
  }

  // 获取上个调整周期的第一个区块
  const adjustmentBlock = this.chain[
    this.chain.length - this.config.difficultyAdjustmentInterval
  ]

  // 计算实际时间
  const actualTime = (latestBlock.timestamp - adjustmentBlock.timestamp) / 1000

  // 计算预期时间
  const expectedTime =
    this.config.targetBlockTime * this.config.difficultyAdjustmentInterval

  const ratio = actualTime / expectedTime

  // 如果实际时间比预期快 2 倍以上，增加难度
  if (ratio < 0.5) {
    return latestBlock.difficulty + 1
  }

  // 如果实际时间比预期慢 2 倍以上，降低难度
  if (ratio > 2) {
    return Math.max(1, latestBlock.difficulty - 1)
  }

  return latestBlock.difficulty
}
```

**难度调整示例：**

```
场景：目标出块时间 10 秒，调整间隔 10 个区块

情况 1：出块太快
  预期时间：10 秒 × 10 = 100 秒
  实际时间：45 秒
  比率：45/100 = 0.45 < 0.5
  调整：难度 +1

情况 2：出块太慢
  预期时间：100 秒
  实际时间：210 秒
  比率：210/100 = 2.1 > 2
  调整：难度 -1

情况 3：速度正常
  预期时间：100 秒
  实际时间：95 秒
  比率：95/100 = 0.95
  调整：难度不变
```

### 5.4 UTXO 集合维护

每当新区块被添加到链上，我们需要更新 UTXO 集合：

```typescript
private updateUTXOSet(block: Block): void {
  for (const tx of block.transactions) {
    // 移除花费的 UTXO（Coinbase 交易除外）
    if (!tx.isCoinbase()) {
      for (const input of tx.inputs) {
        this.utxoSet.remove(input.txId, input.outputIndex)
      }
    }

    // 添加新的 UTXO
    tx.outputs.forEach((output, index) => {
      this.utxoSet.add(tx.id, index, output)
    })
  }
}
```

**UTXO 更新示例：**

初始状态：

| UTXO  | 金额    | 所有者 | 状态 |
| ----- | ------- | ------ | ---- |
| tx1:0 | 100 BTC | Alice  | 有效 |
| tx2:0 | 50 BTC  | Bob    | 有效 |

新区块包含交易 tx3（Alice 转给 Carol 60 BTC）：

| UTXO  | 金额    | 所有者 | 状态   | 操作         |
| ----- | ------- | ------ | ------ | ------------ |
| tx1:0 | 100 BTC | Alice  | 已花费 | 移除         |
| tx2:0 | 50 BTC  | Bob    | 有效   | 保留         |
| tx3:0 | 60 BTC  | Carol  | 有效   | 新增         |
| tx3:1 | 40 BTC  | Alice  | 有效   | 新增（找零） |

Coinbase 交易（tx3_coinbase，矿工奖励 50 BTC）：

| UTXO           | 金额   | 所有者 | 状态 | 操作 |
| -------------- | ------ | ------ | ---- | ---- |
| tx3_coinbase:0 | 50 BTC | Miner  | 有效 | 新增 |

## 六、矿工：打包交易与挖矿

矿工是区块链的维护者。他们选择交易、创建区块、执行工作量证明，并获得奖励。

### 6.1 矿工的工作流程

**完整的挖矿流程：**

```
步骤 1: 选择交易
  - 从交易池选择待确认的交易
  - 按手续费从高到低排序
  - 选择前 N 个交易

步骤 2: 计算奖励
  - 区块奖励：50 BTC（固定）
  - 交易手续费：所有交易的手续费总和
  - 矿工总收益 = 区块奖励 + 交易手续费

步骤 3: 创建 Coinbase 交易
  - 输入：特殊的全零 txId
  - 输出：矿工总收益 → 矿工地址

步骤 4: 构建区块
  - 将 Coinbase 交易放在第一位
  - 添加选中的交易
  - 设置前区块哈希、时间戳、难度

步骤 5: 执行工作量证明
  - 不断尝试 nonce 值
  - 直到找到满足难度的哈希

步骤 6: 广播区块
  - 将挖到的区块添加到区块链
  - 广播给其他节点（我们的简化版本中省略）
```

### 6.2 实现矿工类

```typescript
export class Miner {
  private wallet: Wallet
  private blockchain: Blockchain

  mineBlock(transactions: Transaction[]): {
    block: Block
    miningResult: MiningResult
  } {
    const latestBlock = this.blockchain.getLatestBlock()

    // 计算矿工奖励
    const blockReward = this.blockchain.getBlockReward()
    const totalFees = this.calculateTotalFees(transactions)
    const minerReward = blockReward + totalFees

    // 创建 Coinbase 交易
    const coinbaseTx = Transaction.createCoinbase(
      this.wallet.address,
      minerReward,
      latestBlock.index + 1
    )

    // 构建区块
    const difficulty = this.blockchain.calculateNextDifficulty()
    const newBlock = new Block(
      latestBlock.index + 1,
      latestBlock.hash,
      Date.now(),
      [coinbaseTx, ...transactions],
      difficulty
    )

    // 执行工作量证明
    const miningResult = ProofOfWork.mine(newBlock)

    return {block: newBlock, miningResult}
  }
}
```

### 6.3 交易选择策略

矿工需要从交易池中选择交易。我们采用贪心策略：优先选择手续费高的交易。

```typescript
selectTransactions(
  candidateTransactions: Transaction[],
  maxTransactions: number = 100
): Transaction[] {
  const utxoSet = this.blockchain.getUTXOSet()

  // 计算每个交易的手续费
  const txWithFees = candidateTransactions
    .filter((tx) => !tx.isCoinbase())
    .map((tx) => {
      try {
        const fee = tx.calculateFee(utxoSet.getAll())
        return { tx, fee }
      } catch (error) {
        return null
      }
    })
    .filter((item) => item !== null)

  // 按手续费降序排序
  txWithFees.sort((a, b) => b.fee - a.fee)

  // 取前 N 个交易
  return txWithFees.slice(0, maxTransactions).map((item) => item.tx)
}
```

**交易选择示例：**

交易池：

| 交易 ID | 输入总额 | 输出总额 | 手续费  | 优先级 |
| ------- | -------- | -------- | ------- | ------ |
| tx1     | 100 BTC  | 98 BTC   | 2 BTC   | 1      |
| tx2     | 50 BTC   | 49.5 BTC | 0.5 BTC | 3      |
| tx3     | 80 BTC   | 79 BTC   | 1 BTC   | 2      |
| tx4     | 30 BTC   | 29.9 BTC | 0.1 BTC | 4      |

矿工选择（假设只选 2 个）：

- 选择 tx1（手续费最高）
- 选择 tx3（手续费第二高）

**矿工收益计算：**

```
区块奖励：50 BTC
交易手续费：2 BTC (tx1) + 1 BTC (tx3) = 3 BTC
矿工总收益：50 + 3 = 53 BTC
```

## 七、实际应用场景

让我们通过一个完整的例子看看区块链系统是如何工作的。

### 场景：从创世到多个区块

```typescript
// 1. 创建区块链和钱包
const blockchain = new Blockchain({
  initialDifficulty: 2,
  blockReward: 50,
  targetBlockTime: 10,
  difficultyAdjustmentInterval: 10,
})

const miner = new Wallet()
const alice = new Wallet()
const bob = new Wallet()

// 2. 创建创世区块
const genesisCoinbase = Transaction.createCoinbase(miner.address, 50, 0)
const genesisBlock = Block.createGenesisBlock(genesisCoinbase)
blockchain.initializeWithGenesisBlock(genesisBlock)

console.log('创世区块已创建')
console.log(
  `矿工余额: ${blockchain.getUTXOSet().getBalance(miner.address)} BTC`
)
// 输出: 矿工余额: 50 BTC

// 3. 挖第二个区块
const minerInstance = new Miner(miner, blockchain)
const {block: block1, miningResult: result1} = minerInstance.mineEmptyBlock()

console.log(`\n挖矿区块 #1:`)
console.log(`  哈希: ${result1.hash}`)
console.log(`  尝试次数: ${result1.attempts}`)
console.log(`  用时: ${result1.duration}ms`)

blockchain.addBlock(block1)
console.log(
  `矿工余额: ${blockchain.getUTXOSet().getBalance(miner.address)} BTC`
)
// 输出: 矿工余额: 100 BTC

// 4. 矿工给 Alice 转账
const utxoSet = blockchain.getUTXOSet()
const tx1 = TransactionBuilder.createSimpleTransfer(
  miner,
  alice.address,
  30,
  utxoSet
)

// 5. 挖包含交易的区块
const {block: block2, miningResult: result2} = minerInstance.mineBlock([tx1])
blockchain.addBlock(block2)

console.log(`\n区块 #2 已添加`)
console.log(
  `Alice 余额: ${blockchain.getUTXOSet().getBalance(alice.address)} BTC`
)
// 输出: Alice 余额: 30 BTC

// 6. Alice 给 Bob 转账
const tx2 = TransactionBuilder.createSimpleTransfer(
  alice,
  bob.address,
  15,
  blockchain.getUTXOSet()
)

// 7. 挖包含 Alice 转账的区块
const {block: block3} = minerInstance.mineBlock([tx2])
blockchain.addBlock(block3)

console.log(`\n区块 #3 已添加`)
console.log(`Bob 余额: ${blockchain.getUTXOSet().getBalance(bob.address)} BTC`)
// 输出: Bob 余额: 15 BTC
```

**最终状态：**

区块链状态：

| 区块     | 高度 | 哈希      | 交易数 | 难度 |
| -------- | ---- | --------- | ------ | ---- |
| 创世区块 | 0    | 00a3f2... | 1      | 2    |
| 区块 1   | 1    | 007b1e... | 1      | 2    |
| 区块 2   | 2    | 0045c9... | 2      | 2    |
| 区块 3   | 3    | 00d8f3... | 2      | 2    |

余额汇总：

| 用户  | 余额     | 说明                         |
| ----- | -------- | ---------------------------- |
| Miner | ~170 BTC | 3 次区块奖励 + 找零 + 手续费 |
| Alice | 15 BTC   | 收到 30 - 转出 15            |
| Bob   | 15 BTC   | 从 Alice 收到                |

## 八、总结

在这篇文章中，我们实现了比特币的区块链核心。我们学习了 Merkle 树如何提供高效的交易验证，理解了区块的结构和区块哈希的计算方式。我们深入探讨了工作量证明算法，了解了挖矿的本质是寻找满足难度要求的 nonce 值。我们还实现了区块链管理类，包括区块验证、UTXO 维护和动态难度调整。最后，我们实现了矿工类，它负责选择交易、打包区块和执行挖矿。

这些组件构成了比特币的去中心化账本。有了它们，我们不再需要可信的第三方来维护账本。工作量证明确保了修改历史的成本极高，UTXO 模型确保了不会有双花，Merkle 树提供了高效的验证机制，难度调整保证了稳定的出块时间。

我们的实现是简化的。真实的比特币网络使用更复杂的难度调整算法（每 2016 个区块调整一次），有更严格的时间戳验证规则，并且区块奖励会每 210,000 个区块减半（这就是著名的"减半"机制）。但我们保留了最核心的概念：工作量证明、区块链接、Merkle 树和 UTXO 管理。
