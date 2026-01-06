---
title: AI 代码统计分析系统实践
date: 2026-01-06 10:07:21
tags:
  - ai
categories:
  - ai
---

## 引言

当 AI 能够生成大量代码时，一个新问题随之而来：如何量化团队对 AI 的依赖程度？为了回答这个问题，我构建了一套统计系统，用于追踪和分析仓库中 AI 代码的占比。代码见 https://github.com/ParadeTo/ai-stats

## 快速开始

### 1. 安装与启动

**安装 Cursor 插件**：

克隆本项目后，在 Cursor 编辑器中打开插件目录并安装，插件会自动配置钩子以捕获 AI 生成的代码。

**安装依赖**：

系统分为后端和前端两个部分，需要分别安装依赖：

```bash
# 后端服务
cd server
pnpm install

# 前端面板
cd dashboard
pnpm install
```

**配置环境变量**：

在 `server` 目录下创建 `.env` 文件，配置 GitHub 访问令牌：

```bash
GITHUB_TOKEN=your_github_token_here
```

**启动服务**：

```bash
# 启动后端服务（端口 3001）
cd server
pnpm start

# 启动前端面板（端口 3000）
cd dashboard
pnpm start
```

启动成功后，访问 `http://localhost:3000` 即可看到系统主界面。

### 2. 基本使用流程

#### 步骤 1：使用 AI 生成代码并推送到 GitHub

在 Cursor 编辑器中使用 AI 生成代码。系统会自动捕获这次 AI 生成的差异并存入数据库。完成开发后，将代码提交并推送到 GitHub。

> **重要提示**：只有在代码推送到 GitHub 后，系统才能在项目列表页展示该仓库的分析数据。

#### 步骤 2：查看列表

代码推送到 GitHub 后，打开系统主界面，即可以看到分析的数据：

![项目列表截图占位](ai-stats/project-list.jpg)

#### 步骤 3：查看详情

点击项目，进入详情页面：

![文件分析输入截图占位](ai-stats/detail.jpg)

**查看代码归属**：

点击左侧的文件，系统会展示文件内容，每一行代码都标注了归属：

- 绿色背景：AI 生成
- 白色背景：人工编写
- ● 标记：有未保存的手动标记
- ✓ 标记：已保存的手动标记
- ⚠ 标记：手动标记已失效（内容已变更）

![代码归属展示截图占位](ai-stats/mark.jpg)

![代码归属展示截图占位](ai-stats/invalid.jpg)

**处理重复代码警告**：

如果文件中存在多行相同的代码，系统会在顶部显示警告信息，例如：

![代码归属展示截图占位](ai-stats/invalid.jpg)

#### 步骤 4：手动标记

对于系统无法准确判断的代码（如重复代码），可以手动标记。点击代码行号，该行的归属会在 AI/人工之间，点击页面顶部的"保存手动标记"按钮。

![代码归属展示截图占位](ai-stats/mark.jpg)

手动标记会存储在数据库中，并在后续所有分析中优先使用。

#### 步骤 5：Commit 范围分析

如果需要分析特定 commit 范围内的代码变更，可以：

1. 勾选"使用 commit 范围分析"
2. 输入起始 commit 和结束 commit 的哈希值
3. 点击"分析"

系统会展示该范围内的所有变更，并标注每一行的增删状态和 AI 归属。

![Commit 范围分析截图占位](ai-stats/range.jpg)

以下章节将详细介绍系统的技术实现原理。

## 系统架构概览

AI 代码追踪系统采用三层架构设计，分别是插件层、后端层和前端层。每一层承担不同的职责，共同构成了完整的追踪链路。

### 系统架构图

![系统架构图](ai-stats/ai-stats-architecture.png)

## 插件层：实时捕获机制

插件层是整个系统的数据入口，它的核心任务是准确捕获 AI 生成的代码。

### Cursor 钩子系统

Cursor 编辑器提供了生命周期钩子机制，允许开发者在特定事件发生时执行自定义脚本。系统通过修改 Cursor 的配置文件 `~/.cursor/hooks.json` 来注册钩子：

```json
{
  "stop": "/path/to/stop.js"
}
```

核心钩子是 `stop`，它在每次 AI 代码生成完成且用户点击"应用"按钮时被触发。当钩子被触发时，Cursor 会通过标准输入流向脚本传递一个 JSON 对象，包含丰富的元数据：

```json
{
  "conversation_id": "conv-abc123",
  "generation_id": "gen-xyz789",
  "model": "gpt-4",
  "workspace_roots": ["/Users/username/project"],
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

这些元数据为后续的数据分析提供了重要的上下文信息。

### stop.js 脚本的工作流程

stop.js 脚本是插件层的核心组件，它执行以下步骤来完成数据捕获：

#### 1. 读取元数据

脚本首先从标准输入读取 Cursor 传入的元数据：

```javascript
const cursorData = await readStdin()
const metadata = JSON.parse(cursorData)
const workspaceRoot = metadata.workspace_roots[0]
```

关键技术细节：脚本需要从元数据中提取 `workspace_roots` 字段，这个字段包含了用户项目的本地路径，用于后续的 Git 操作。

#### 2. 获取 Git 差异

这里需要处理两种情况：

**情况 A：已跟踪文件的修改**

```bash
git diff
```

**情况 B：未跟踪的新文件**

Git 默认不会将未跟踪的新文件包含在差异中。系统使用 `git add -N` 命令将新文件临时标记为"意图添加"状态：

```javascript
// 获取未跟踪的文件
const statusOutput = execSync('git status --porcelain', {cwd})
const untrackedFiles = statusOutput
  .split('\n')
  .filter((line) => line.startsWith('??'))
  .map((line) => line.substring(3).trim())

// 临时标记为意图添加
untrackedFiles.forEach((file) => {
  execSync(`git add -N "${file}"`, {cwd})
})

// 获取差异（现在包含新文件）
const diff = execSync('git diff', {cwd})

// 撤销临时操作
execSync('git reset', {cwd})
```

#### 3. 压缩和传输

获取到差异后，脚本进行压缩处理：

```javascript
// 压缩差异数据（通常能减少到原来的 10-20%）
const compressed = zlib.gzipSync(Buffer.from(diff))
const base64 = compressed.toString('base64')

// 发送到后端
await fetch('http://localhost:3001/api/create-task', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    generation_id: metadata.generation_id,
    compressed_diff: base64,
    repo_url: getRepoUrl(workspaceRoot),
    branch_name: getCurrentBranch(workspaceRoot),
    model: metadata.model,
  }),
})
```

### 完整捕获示例

**场景**：开发者小李在 Cursor 中请求 AI 生成一个快速排序函数。

**步骤 1**：AI 生成代码

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr
  const pivot = arr[0]
  const left = arr.filter((x) => x < pivot)
  const right = arr.filter((x) => x > pivot)
  return [...quickSort(left), pivot, ...quickSort(right)]
}
```

**步骤 2**：小李点击"应用"按钮，stop.js 脚本被触发

**步骤 3**：脚本执行 `git diff`，获取差异

```diff
diff --git a/utils.js b/utils.js
@@ -0,0 +1,7 @@
+function quickSort(arr) {
+    if (arr.length <= 1) return arr;
+    const pivot = arr[0];
+    const left = arr.filter(x => x < pivot);
+    const right = arr.filter(x => x > pivot);
+    return [...quickSort(left), pivot, ...quickSort(right)];
+}
```

**步骤 4**：脚本压缩、编码并发送到后端

```javascript
{
    "generation_id": "gen-1234567890",
    "compressed_diff": "H4sIAAAAAAAAA+1WTW/bMAy9...",
    "repo_url": "https://github.com/user/myproject.git",
    "branch_name": "feature-sort",
    "model": "gpt-4"
}
```

**步骤 5**：后端存储到数据库，完成捕获

## 后端层：存储与分析算法

后端层是整个系统的核心，它不仅要存储数据，更重要的是提供智能的分析能力。

### 数据库设计

后端使用 SQLite 数据库存储 AI 代码生成记录。表结构设计如下：

```sql
-- AI 代码生成记录表
CREATE TABLE task_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    repo_url TEXT NOT NULL,
    branch_name TEXT,
    model TEXT,
    compressed_diff TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 手动标记表（用于修正自动识别的误判）
CREATE TABLE manual_attributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    branch TEXT,
    commit_hash TEXT,
    line_number INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    attribution TEXT NOT NULL CHECK(attribution IN ('ai', 'human')),
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo_url, file_path, branch, line_number, commit_hash)
);
```

**存储示例**：

```sql
INSERT INTO task_records VALUES (
    1,
    'gen-1234567890',
    'developer001',
    'https://github.com/user/myproject.git',
    'feature-sort',
    'gpt-4',
    'H4sIAAAAAAAAA+1WTW/bMAy9...',
    '2024-01-15 10:30:45'
);
```

压缩后的差异数据以 Base64 编码的字符串形式存储。当需要分析时，系统会：

1. 从数据库读取 Base64 字符串
2. 解码为二进制数据
3. 使用 Gzip 解压缩，还原为原始 diff 文本
4. 使用 parse-diff 库解析 diff，提取出每一行代码

### 核心算法：内容哈希匹配

系统识别 AI 代码的核心算法基于内容哈希匹配。这个算法的设计经过了多次迭代优化，最终形成了一套完整的解决方案。

#### 算法原理

**基本思想**：为每一行代码计算一个唯一的哈希值（"指纹"），通过比较哈希值来判断代码的来源。

**哈希计算**：

```javascript
function hashLine(line) {
  return crypto
    .createHash('sha256')
    .update(line.trim()) // 去除首尾空格
    .digest('hex')
    .substring(0, 16) // 取前 16 个字符
}
```

**示例**：

```javascript
hashLine('    return true;') // → "a3f5e9d2b1c8f4e1"
hashLine('return true;') // → "a3f5e9d2b1c8f4e1" (相同)
hashLine('    return false;') // → "b7c2d4e8f1a9b3c5" (不同)
```

#### AI 代码索引数据结构

系统使用 Map（映射）数据结构来存储 AI 生成的代码信息。可以把它理解为一个"字典"，通过代码的"指纹"（哈希值）来查找这行代码的详细信息。

**基本结构**：

```javascript
const aiLinesMap = new Map()

// 添加一条记录
aiLinesMap.set('a3f5e9d2b1c8f4e1', {
  timestamp: '2024-01-15T10:00:00Z',
  generation_id: 'gen-123',
  count: 1,
  occurrences: [
    {
      timestamp: '2024-01-15T10:00:00Z',
      generation_id: 'gen-123',
    },
  ],
})
```

**字段详解**：

| 字段              | 类型   | 说明                          | 示例                     |
| ----------------- | ------ | ----------------------------- | ------------------------ |
| **键（Key）**     | string | 代码行的哈希值，作为唯一标识  | `"a3f5e9d2b1c8f4e1"`     |
| **timestamp**     | string | AI **最早**生成这行代码的时间 | `"2024-01-15T10:00:00Z"` |
| **generation_id** | string | 对应最早生成记录的 ID         | `"gen-123"`              |
| **count**         | number | AI 生成这行代码的**总次数**   | `3` 表示 AI 生成过 3 次  |
| **occurrences**   | Array  | 所有生成记录的**完整列表**    | 见下方示例               |

**完整示例**：

假设 AI 在不同时间多次生成了同一行代码 `return true;`：

```javascript
// 第一次生成（2024-01-15）
AI 生成: return true;

// 第二次生成（2024-01-20）
AI 又生成了一次: return true;

// 第三次生成（2024-01-25）
AI 再次生成: return true;
```

存储在 Map 中的数据：

```javascript
aiLinesMap.set('hash(return true;)', {
  // 最早的生成时间（第一次）
  timestamp: '2024-01-15T10:00:00Z',

  // 最早生成记录的 ID
  generation_id: 'gen-123',

  // 总共生成了 3 次
  count: 3,

  // 所有生成记录的详细列表
  occurrences: [
    {
      timestamp: '2024-01-15T10:00:00Z',
      generation_id: 'gen-123',
    },
    {
      timestamp: '2024-01-20T14:30:00Z',
      generation_id: 'gen-456',
    },
    {
      timestamp: '2024-01-25T09:15:00Z',
      generation_id: 'gen-789',
    },
  ],
})
```

**为什么要记录 timestamp（最早时间）？**

让我用一个真实的开发场景来说明：

**完整的开发时间线**：

```javascript
// ============ 1月10日：你开始写项目 ============
// 文件 utils.js (version 1)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms)) // ← 你自己写的
}

// ============ 1月15日：你用 AI 生成了验证函数 ============
// 文件 utils.js (version 2)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms)) // ← 你自己写的
}

function validate(data) {
  if (!data) return false // ← AI 生成
  return new Promise((resolve) => setTimeout(resolve, ms)) // ← AI 复用了相同代码
}

// 此时数据库记录：
// - hash("return new Promise(...)") → timestamp = 1月15日
```

**问题来了**：现在文件中有**两行**一模一样的 `return new Promise(...)`

- 第 1 行：你在 1 月 10 日写的
- 第 2 行：AI 在 1 月 15 日生成的

**如果没有 timestamp，会发生什么？**

```javascript
// 系统只知道：AI 生成过 return new Promise(...)
// 结果：两行都被标记为 AI（错误！）
// 你1月10日的劳动成果被错误归给了 AI
```

**有了 timestamp，系统怎么判断？**

```javascript
// 第1行 return new Promise(...)
codeTime = 1月10日 (Git commit 时间)
aiTimestamp = 1月15日 (AI 第一次生成的时间)

if (codeTime < aiTimestamp) {
    // 1月10日 < 1月15日
    // 结论：这行代码在 AI 生成之前就存在了
    // 判定：人工编写（正确）
}

// 第2行 return new Promise(...)
codeTime = 1月15日 (Git commit 时间)
aiTimestamp = 1月15日 (AI 第一次生成的时间)

if (codeTime >= aiTimestamp) {
    // 1月15日 >= 1月15日
    // 结论：这行代码在 AI 生成之后出现的
    // 判定：AI 生成（正确）
}
```

**总结**：

timestamp 就像一个"时间戳"，告诉系统：

- "AI 是从 1 月 15 日开始知道这行代码的"
- "如果某行代码在 1 月 15 日之前就存在，那肯定不是 AI 写的"
- "如果某行代码在 1 月 15 日之后出现，那可能是 AI 写的"（也有可能 AI 写了，人工删除又添加回来了）

没有 timestamp，系统只能简单地认为"凡是内容相同的代码都是 AI"，这会错误地把你的劳动成果归给 AI。有了 timestamp，系统能区分"谁先写的"，避免误判。

**为什么要记录 count？**

用于检测重复代码问题。例如：

```javascript
// 场景：文件中有 5 行 return true;
const fileCount = 5

// 查询 AI 信息
const aiInfo = aiLinesMap.get(hash('return true;'))
// aiInfo.count = 3

// 判断：文件中有 5 行，但 AI 只生成了 3 次
if (fileCount > aiInfo.count) {
  console.log('警告：有些相同的代码可能是人工编写的')
  console.log(`估算：${aiInfo.count} 行 AI，${fileCount - aiInfo.count} 行人工`)
}

// 输出：
// 警告：有些相同的代码可能是人工编写的
// 估算：3 行 AI，2 行人工
```

#### 从数据库构建 AI 代码索引

**目标**：将数据库中存储的 AI 生成记录转换成一个可快速查询的索引结构。

**输入**：数据库中的 AI 生成记录（包含压缩的 diff 数据、时间戳等）

**输出**：`Map<内容哈希, 元数据>`，用于快速判断某行代码是否为 AI 生成

**核心思路**：

1. 从数据库读取所有 AI 生成记录
2. 解压每条记录的 diff 数据
3. 提取所有新增的代码行
4. 为每行代码计算哈希值
5. 将哈希值和元数据（时间戳、生成次数等）存入 Map

系统通过 `buildAiLinesMap` 函数实现这个过程：

```javascript
function buildAiLinesMap(rows, zlib, parseDiff) {
  const aiLinesMap = new Map()

  rows.forEach((row) => {
    // 1. 解压缩差异数据
    const buffer = Buffer.from(row.compressed_diff, 'base64')
    const decompressed = zlib.gunzipSync(buffer).toString('utf8')
    const files = parseDiff(decompressed)

    // 2. 遍历所有新增的代码行
    files.forEach((file) => {
      file.chunks.forEach((chunk) => {
        chunk.changes.forEach((change) => {
          if (change.type === 'add') {
            const content = change.content.substring(1)
            const hash = hashLine(content) // 3. 计算哈希

            // 4. 存入 Map（记录时间戳、次数等）
            if (!aiLinesMap.has(hash)) {
              // 首次出现
              aiLinesMap.set(hash, {
                timestamp: row.created_at,
                generation_id: row.generation_id,
                count: 1,
                occurrences: [
                  {
                    timestamp: row.created_at,
                    generation_id: row.generation_id,
                  },
                ],
              })
            } else {
              // 已存在，增加计数
              const existing = aiLinesMap.get(hash)
              existing.count++
              existing.occurrences.push({
                timestamp: row.created_at,
                generation_id: row.generation_id,
              })

              // 保持最早的时间戳
              if (row.created_at < existing.timestamp) {
                existing.timestamp = row.created_at
                existing.generation_id = row.generation_id
              }
            }
          }
        })
      })
    })
  })

  return aiLinesMap
}
```

**生成的 Map 结构示例**：

```javascript
Map([
  [
    'a3f5e9d2b1c8f4e1',
    {
      timestamp: '2024-01-15T10:00:00Z', // 最早生成时间
      generation_id: 'gen-123', // 对应的生成任务 ID
      count: 2, // AI 生成了 2 次
      occurrences: [
        // 所有生成记录
        {timestamp: '2024-01-15T10:00:00Z', generation_id: 'gen-123'},
        {timestamp: '2024-01-20T15:00:00Z', generation_id: 'gen-456'},
      ],
    },
  ],
  // ... 更多代码行的哈希和元数据
])
```

有了这个 Map，判断某行代码是否为 AI 生成就非常简单：

```javascript
const hash = hashLine('return true;')
const isAI = aiLinesMap.has(hash) // 快速查询
```

下面通过几个案例来进行说明。

### 案例 1：基本的代码归属分析

**场景**：分析一个包含 AI 和人工代码的文件。

**数据库记录**（2024-01-15 生成）：

```javascript
// AI 生成的快速排序函数
function quickSort(arr) {
  if (arr.length <= 1) return arr
  const pivot = arr[0]
  return [...quickSort(left), pivot, ...quickSort(right)]
}
```

**当前文件内容**（utils.js）：

```javascript
// 工具函数集合

function quickSort(arr) {
  if (arr.length <= 1) return arr
  const pivot = arr[0]
  return [...quickSort(left), pivot, ...quickSort(right)]
}

// 人工添加的格式化函数
function formatDate(date) {
  return date.toISOString().split('T')[0]
}
```

**分析过程**：

**步骤 1**：构建 AI 代码索引

```javascript
aiLinesMap = Map([
    ['hash("function quickSort(arr) {")', {
        timestamp: '2024-01-15T10:00:00Z',
        generation_id: 'gen-123',
        count: 1
    }],
    ['hash("    if (arr.length <= 1) return arr;")', { ... }],
    ['hash("    const pivot = arr[0];")', { ... }],
    ['hash("    return [...quickSort(left), pivot, ...quickSort(right)];")', { ... }],
    ['hash("}")', { ... }]
]);
```

**步骤 2**：逐行分析文件

```javascript
第1行: "// 工具函数集合"
  hash → 不在 aiLinesMap 中 → 人工编写

第2行: ""
  hash → 不在 aiLinesMap 中 → 人工编写

第3行: "function quickSort(arr) {"
  hash → 在 aiLinesMap 中 → AI 生成

第4行: "    if (arr.length <= 1) return arr;"
  hash → 在 aiLinesMap 中 → AI 生成

第5行: "    const pivot = arr[0];"
  hash → 在 aiLinesMap 中 → AI 生成

第6行: "    return [...quickSort(left), pivot, ...quickSort(right)];"
  hash → 在 aiLinesMap 中 → AI 生成

第7行: "}"
  hash → 在 aiLinesMap 中 → AI 生成

第8行: ""
  hash → 不在 aiLinesMap 中 → 人工编写

第9行: "// 人工添加的格式化函数"
  hash → 不在 aiLinesMap 中 → 人工编写

第10行: "function formatDate(date) {"
  hash → 不在 aiLinesMap 中 → 人工编写

第11行: "    return date.toISOString().split('T')[0];"
  hash → 不在 aiLinesMap 中 → 人工编写

第12行: "}"
  hash → 不在 aiLinesMap 中 → 人工编写
```

**分析结果**：

```json
{
    "stats": {
        "total_lines": 12,
        "ai_lines": 5,
        "human_lines": 7
    },
    "analysis": [
        { "lineNumber": 1, "attribution": "human", ... },
        { "lineNumber": 2, "attribution": "human", ... },
        { "lineNumber": 3, "attribution": "ai", "generation_id": "gen-123" },
        { "lineNumber": 4, "attribution": "ai", "generation_id": "gen-123" },
        ...
    ]
}
```

### 案例 2：时间过滤的局限性

**场景**：AI 生成的代码被删除后，人工重新添加了相同的代码。

**时间线**：

```
2024-01-15 10:00:00  AI 生成: return true;
2024-01-16 11:00:00  人工删除这行代码
2024-01-17 12:00:00  人工重新添加: return true;
```

**问题**：如何区分这两次 `return true;` 的来源？

**当前实现**：使用时间过滤

```javascript
// 获取文件的最后修改时间
const fileTimestamp = '2024-01-17T12:00:00Z'

// 分析时传入时间戳
analyzeFileAttribution(lines, aiLinesMap, {
  fileTimestamp: fileTimestamp,
})
```

**分析逻辑**：

```javascript
const aiInfo = aiLinesMap.get(hash('return true;'))
// aiInfo = {
//     timestamp: '2024-01-15T10:00:00Z',  // AI 第一次生成的时间
//     generation_id: 'gen-123',
//     count: 1
// }

// 时间戳判断
if (aiInfo && aiInfo.timestamp <= fileTimestamp) {
  // '2024-01-15' <= '2024-01-17' (条件满足)
  // AI 在文件修改之前就生成过这行代码
  // 判断：标记为 AI 代码
  isAI = true
} else {
  // AI 生成时间晚于文件时间，或者 AI 没生成过
  // 判断：标记为人工代码
  isAI = false
}
```

**当前实现的局限性**：

系统目前只使用时间戳进行简单比较，**无法识别"删除 → 重新添加"的场景**。

在案例的场景中（AI 生成 → 删除 → 人工重新添加），系统会：

- [正确识别] AI 在 1 月 15 日生成过 `return true;`
- [误判结果] 1 月 17 日的 `return true;` 也会被标记为 AI（因为时间戳满足条件）
- [无法识别] 中间的"删除 → 重新添加"过程

**改进方向**：

- 需要结合 Git 历史分析（`git log --follow`）追踪代码的删除和重新添加

### 案例 3：重复代码的处理

**场景**：文件中有多行相同的代码，但来源不同。

**文件内容**：

```javascript
function check1() {
  return true // 人工编写
}

function check2() {
  return true // AI 生成
}

function check3() {
  return true // 人工编写
}
```

**AI 记录**：只有 1 次生成 `return true;`

**问题**：三行 `return true;` 的哈希值完全相同，如何判断？

**算法处理**：

**步骤 1**：统计文件中的重复代码

```javascript
const hashCounts = new Map()
lines.forEach((content) => {
  const hash = hashLine(content)
  hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1)
})

// 结果
hashCounts.get(hash('return true;')) === 3 // 文件中有 3 行
```

**步骤 2**：对比 AI 生成次数

```javascript
const aiInfo = aiLinesMap.get(hash('return true;'))
aiInfo.count === 1 // AI 只生成了 1 次

// 检测到不匹配
if (fileCount !== aiCount) {
  // 3 !== 1，有重复代码问题
}
```

**步骤 3**：生成警告和估算

```javascript
{
    "analysis": [
        { "lineNumber": 2, "attribution": "ai" },  // [注意] 基于哈希匹配标记为 AI
        { "lineNumber": 5, "attribution": "ai" },  // [注意] 但实际上可能有人工代码
        { "lineNumber": 8, "attribution": "ai" }   // [注意] 无法精确判断哪一行是人工
    ],
    "warning": "[警告] 检测到重复代码，逐行归属可能不准确。请参考 duplicateStats 获取更准确的估算。",
    "duplicateStats": {
        "hash(return true;)": {
            "content": "return true;",
            "total_in_file": 3,
            "ai_count": 1,
            "estimated_ai_lines": 1,      // [更准确] 基于统计的估算
            "estimated_human_lines": 2,    // [更准确] 基于统计的估算
            "confidence": "low",
            "note": "文件中有 3 行此代码，AI 生成了 1 次，可能有 2 行是人工编写"
        }
    }
}
```

**设计理念**：

当检测到重复代码时，系统采用"诚实报告"策略：

1. **逐行归属**（`analysis`）：基于哈希匹配，可能不准确（3 行都标记为 AI，存在误判）
2. **统计估算**（`duplicateStats`）：基于 AI 生成次数，更接近真实情况（1 AI + 2 人工）
3. **警告信息**（`warning`）：明确告知用户"逐行归属可能不准确"

系统**不会强行猜测**哪一行是 AI、哪一行是人工（因为这在技术上无法准确判断），而是提供多个维度的信息，让用户自己判断。这种设计比给出错误的精确结果更有价值。

**手动标记功能**：

为了解决重复代码等无法自动准确判断的场景，系统提供了手动标记功能：

1. **交互方式**：用户点击代码行号，即可切换该行的归属（AI ↔ 人工）
2. **优先级**：手动标记的优先级最高，会覆盖自动识别的结果
3. **内容验证**：通过内容哈希验证，确保标记的准确性
4. **持久化**：手动标记存储在数据库中，刷新页面后仍然有效

**手动标记流程**：

```javascript
// 1. 用户点击第 6 行的行号
// 2. 前端发送 POST 请求
POST /api/manual-attribution
{
    "repo_url": "https://github.com/user/repo.git",
    "file_path": "test.js",
    "branch": "main",
    "manual_attributions": [
        {
            "lineNumber": 6,
            "content": "console.log('hello');",
            "attribution": "human"  // 从 AI 改为人工
        }
    ]
}

// 3. 后端保存到数据库，并计算内容哈希
INSERT INTO manual_attributions (repo_url, file_path, branch, line_number, content_hash, attribution)
VALUES ('...', 'test.js', 'main', 6, 'b98785ede1f35602', 'human');

// 4. 再次分析文件时，手动标记优先
const result = analyzeFileAttribution(lines, aiLinesMap);

// 构建手动标记映射（按行号索引）
const manualMap = new Map();
manualMap.set(6, {
    attribution: 'human',
    content_hash: 'b98785ede1f35602'
});

// 应用手动标记（行号+内容双重验证）
result.analysis.forEach(line => {
    const manual = manualMap.get(line.lineNumber);
    if (manual) {
        const currentHash = hashLine(line.content);
        if (manual.content_hash === currentHash) {
            // 行号和内容都匹配，应用手动标记
            line.attribution = manual.attribution;
            line.isManual = true;
            line.autoAttribution = 'ai'; // 保留原自动识别结果
        } else {
            // 内容已变，手动标记失效
            line.manualInvalid = true;
        }
    }
});
```

选择"行号+内容匹配"的原因：

1. **避免误匹配**：重复代码场景下，用户只想标记特定一行，不应影响其他行
2. **明确性**：行号失效时会显示 `manualInvalid: true`，用户可以重新标记
3. **可预测性**：用户点击哪一行，就只影响那一行

### 案例 4：Commit 范围分析

**场景概述**：分析两个 commit 之间的代码变更，计算 AI 代码占比。

Commit 范围分析的核心是判断：在指定的 commit 范围内，哪些新增/删除是 AI 做的。这涉及三个关键数据结构：

1. **`allAiLines`**：历史上所有 AI 添加的代码（从数据库查询得到）
2. **`allAiDeletes`**：历史上所有 AI 删除的代码（从数据库查询得到）
3. **`aiLinesInRange`**：当前 commit 范围内 AI 添加的代码

**`aiLinesInRange` 的构建过程**：

通过两遍扫描 Git diff 来构建。第一遍扫描所有新增行，检查其哈希是否在 `allAiLines` 中，如果在就加入 `aiLinesInRange`：

```javascript
// 第一遍：识别当前 range 内 AI 添加的行
const aiLinesInRange = new Set()

diffFile.chunks.forEach((chunk) => {
  chunk.changes.forEach((change) => {
    if (change.type === 'add') {
      const content = change.content.substring(1)
      const hash = hashLine(content)
      if (allAiLines.has(hash)) {
        aiLinesInRange.add(hash)
      }
    }
  })
})
```

**新增操作的判断逻辑**：

```javascript
if (allAiLines.has(hash)) {
  // 哈希在 AI 历史记录中 → AI 新增
} else {
  // 否则 → 人工新增
}
```

**删除操作的判断逻辑**：

```javascript
if (allAiDeletes.has(hash)) {
  // 检查 1：AI 历史上删除过这行 → AI 删除
} else if (aiLinesInRange.has(hash)) {
  // 检查 2：这行是范围内 AI 添加的 → AI 删除
} else {
  // 否则 → 人工删除
}
```

#### 案例 4.1：aiLinesInRange 为空

#### 代码演变过程

**第 1 步（Commit A）- 基础代码**

2024-01-10，小王手动创建了基础文件：

```javascript
// utils.js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

**第 2 步（Commit B）- AI 添加功能**

2024-01-15，AI 助手添加了防抖函数：

```javascript
// utils.js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function debounce(func, wait) {
  // ← AI 生成的 5 行代码
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
```

**第 3 步（Commit C）- 小王简化 sleep**

2024-01-20，小王觉得 sleep 函数太复杂，删除了 Promise 那行：

```javascript
// utils.js
function sleep(ms) {
  // 删除了 return new Promise(...) 这行
}

function debounce(func, wait) {
  // ← 保持不变
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
```

#### 分析任务

小王想知道：**从 Commit B 到 Commit C，这次改动中有多少是 AI 的贡献？**

#### Git Diff（B → C）

```diff
--- a/utils.js (Commit B)
+++ b/utils.js (Commit C)
@@ function sleep(ms) {
-    return new Promise(resolve => setTimeout(resolve, ms));
 }
```

只有 1 行删除，没有新增。

#### 系统分析过程

```javascript
// 步骤 1：找出 B → C 范围内，AI 新增了哪些代码
const aiLinesInRange = new Set();

遍历 Git diff (B → C)：
  - 发现 0 行新增
  - 发现 1 行删除：return new Promise(...)

结果：aiLinesInRange 为空（B → C 期间 AI 没有添加代码）

// 步骤 2：判断这 1 行删除是谁做的
被删除的代码：return new Promise(resolve => setTimeout(resolve, ms));

检查 1：数据库中有 AI 删除过这行的记录吗？
  → 查询 allAiDeletes.has(hash('return new Promise(...)'))
  → 结果：false（没有）

检查 2：这行是在 B → C 期间 AI 添加的吗？
  → 查询 aiLinesInRange.has(hash('return new Promise(...)'))
  → 结果：false（不是）

结论：标记为 人工删除
```

#### 分析结果

```json
{
  "from_commit": "B",
  "to_commit": "C",
  "stats": {
    "added": 0, // B → C 没有新增代码
    "deleted": 1, // 删除了 1 行
    "ai_added": 0, // AI 没有添加代码
    "ai_deleted": 0 // AI 没有删除代码
  }
}
```

#### 案例 4.2：aiLinesInRange 不为空

#### 代码演变过程

**Commit A（起点）**

2024-01-10，基础代码：

```javascript
// utils.js
function add(a, b) {
  return a + b
}
```

**Commit B（终点）**

2024-01-15，AI 重构代码：

```javascript
// utils.js
function add(a, b) {
  // 优化后的实现           // ← AI 添加的注释
  return a + b // ← AI 添加的新行
}

function multiply(a, b) {
  // ← AI 添加的新函数
  return a * b
}
```

从 Commit A 到 Commit B，AI 贡献了多少代码？

#### Git Diff（A → B）

```diff
--- a/utils.js (Commit A)
+++ b/utils.js (Commit B)
@@ -1,3 +1,7 @@
 function add(a, b) {
-    return a + b;            ← 删除旧行
+    // 优化后的实现           ← AI 添加
+    return a + b;            ← AI 添加（虽然内容相同，但是新的一行）
 }
+
+function multiply(a, b) {    ← AI 添加
+    return a * b;            ← AI 添加
+}
```

变更：

- 删除 1 行
- 添加 4 行

#### 系统分析过程

**步骤 1：找出 A → B 范围内，AI 添加了哪些代码**

```javascript
const aiLinesInRange = new Set();

遍历 Git diff (A → B) 的所有新增行：
  第 1 行：
    → 查询数据库：在 AI 代码索引中 ✓
    → 加入 aiLinesInRange

  第 2 行：return a + b;
    → 查询数据库：在 AI 代码索引中 ✓
    → 加入 aiLinesInRange

  第 3 行：function multiply(a, b) {
    → 查询数据库：在 AI 代码索引中 ✓
    → 加入 aiLinesInRange

  第 4 行：return a * b;
    → 查询数据库：在 AI 代码索引中 ✓
    → 加入 aiLinesInRange

结果：aiLinesInRange 包含 4 个哈希值
```

**步骤 2：判断删除操作的归属**

被删除的代码：`return a + b;`（旧的那行）

```javascript
const hash = hashLine('return a + b;');

检查 1：AI 历史上删除过这行吗？
  → allAiDeletes.has(hash)
  → false（这是第一次删除这行）

检查 2：这行是在 A → B 期间 AI 添加的吗？
  → aiLinesInRange.has(hash)
  → true！（AI 在这个范围内添加了 return a + b;）

结论：标记为 AI 删除
```

#### 分析结果

```json
{
  "from_commit": "A",
  "to_commit": "B",
  "stats": {
    "added": 4, // 新增 4 行
    "deleted": 1, // 删除 1 行
    "ai_added": 4, // AI 添加了 4 行
    "ai_deleted": 1 // AI 删除了 1 行（因为 AI 在范围内添加了相同内容）
  }
}
```

`aiLinesInRange` 的作用是识别 AI 在当前 commit 范围内"删除旧代码 + 添加相同内容新代码"的重构行为，将这类删除操作正确归属给 AI。如果没有这个数据结构，由于 `allAiDeletes` 中没有这行代码的删除记录，系统会将其误判为人工删除，导致统计结果出现偏差。

## 总结

AI 代码追踪系统通过"源头捕获 + 内容哈希匹配"实现 AI 代码的准确追踪。系统在 AI 生成代码的瞬间捕获差异，使用内容哈希识别代码，即使代码位置变化也能正确匹配。

不过整个系统还存在一些问题，可以做进一步优化的。

比如现在存在删除后重写的代码会被误判的问题。具体来说就是，当 AI 生成了一行代码，用户删除后又手动写回相同内容时，系统仍会将其标记为 AI 代码。这是因为当前只做内容哈希匹配，没有追踪代码的"生命周期"。后续可结合 `git log --follow` 分析代码的删除和重新添加历史，识别出"删除 → 人工重写"的场景。

还有目前系统仅支持单人使用，团队成员的追踪数据各自独立，无法聚合查看。后续可设计数据同步机制和权限管理，提供团队级别的统计视图。
