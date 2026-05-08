# ai-agent-digital-team-4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写完系列第四篇文章"把四个机制装配成一个团队"，涵盖四个拼装接缝代码拆解 + 六阶段全流程演示 + 飞书截图占位。

**Architecture:** 用 write-tech-article skill 写作，draw-diagram skill 绘制架构图，review-tech-article + humanizer 完成质量闭环。文章以六阶段流程为主线，四个接缝在对应阶段自然插入，Demo 实录节预留 5 个飞书截图占位由作者填入。

**Tech Stack:** Hexo 3.7 + NexT 主题，`npx hexo new` 创建文章，write-tech-article / draw-diagram / review-tech-article / humanizer skills。

---

### Task 1: 创建文章文件和素材目录

**Files:**
- Create: `source/_posts/ai-agent-digital-team-4.md`（由 hexo new 生成）
- Create: `source/_posts/ai-agent-digital-team-4/`（同步创建，存放图片）

- [ ] **Step 1: 用 hexo new 创建文章**

```bash
cd /Users/youxingzhi/ayou/blog
npx hexo new "简单实战一下 Multi-Agent 数字员工（四）：把四个机制装配成一个团队"
```

Expected: 生成 `source/_posts/简单实战一下 Multi-Agent 数字员工（四）：把四个机制装配成一个团队.md` 和同名目录。

- [ ] **Step 2: 重命名文件为 kebab-case**

```bash
mv "source/_posts/简单实战一下 Multi-Agent 数字员工（四）：把四个机制装配成一个团队.md" \
   source/_posts/ai-agent-digital-team-4.md
mv "source/_posts/简单实战一下 Multi-Agent 数字员工（四）：把四个机制装配成一个团队" \
   source/_posts/ai-agent-digital-team-4
```

- [ ] **Step 3: 更新 frontmatter**

打开 `source/_posts/ai-agent-digital-team-4.md`，将 frontmatter 替换为：

```yaml
---
title: 简单实战一下 Multi-Agent 数字员工（四）：把四个机制装配成一个团队
date: 2026-05-10 20:00:00
tags:
  - ai
  - agent
  - multi-agent
categories:
  - ai
description: 数字团队系列终篇。把角色定义、邮箱通信、Human 介入、自我进化四个机制装进同一个进程，用一个 URL 短链服务项目跑完整六阶段交付，拆解四个让系统真正跑通的拼装接缝。
---
```

- [ ] **Step 4: 提交脚手架**

```bash
git add source/_posts/ai-agent-digital-team-4.md source/_posts/ai-agent-digital-team-4/
git commit -m "blog: scaffold ai-agent-digital-team-4"
```

---

### Task 2: 绘制三层架构图

**Files:**
- Create: `source/_posts/ai-agent-digital-team-4/arch.png`（通过 draw-diagram skill 生成）

- [ ] **Step 1: 调用 draw-diagram skill 绘制 L1/L2/L3 分层图**

调用 `draw-diagram` skill，要求绘制三层架构图，内容如下：

```
三层架构（从下到上）：

L1 基础设施层（灰色底）
  Runner · CronService · 飞书 WebSocket

L2 记忆层（蓝色底，标注"22 课继承，原样复用"）
  四件套 Bootstrap（soul / agent / memory / user）
  跨 session 持久化（ctx.json）

L3 团队协作层（橙色底，标注"本篇新增"）
  四角色（Manager · PM · RD · QA）
  8 个团队工具 · 三态邮箱 · 事件流

箭头方向：L1 → L2 → L3（向上继承）
```

图片保存到 `source/_posts/ai-agent-digital-team-4/arch.png`。

- [ ] **Step 2: 在文章中预留图片引用位置（写 Task 3 时使用）**

图片引用格式：`![三层架构图](./ai-agent-digital-team-4/arch.png)`

---

### Task 3: 写前言 + 架构鸟瞰

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`（在 frontmatter 后追加内容）

- [ ] **Step 1: 调用 write-tech-article skill**

在开始写之前，先调用 `write-tech-article` skill（CLAUDE.md 要求）。

- [ ] **Step 2: 写前言（约 300 字）**

写入以下内容（用自己的语言，不要照搬，保持系列风格）：

核心要点：
- 承接前三篇：角色定义 → 邮箱通信 → Human 介入 → 自我进化，每篇解决一个维度
- 类比："招了四个能干的人，但协作一团糟"——不是能力问题，是拼装问题
- 今天的任务：把四个机制装进同一个进程，用 URL 短链服务项目验证端到端能不能跑
- 核心问题：**四个机制拼在一起，哪些地方需要补胶水代码？**

- [ ] **Step 3: 写架构鸟瞰（约 200 字 + 图）**

核心要点：
- 插入架构图：`![三层架构图](./ai-agent-digital-team-4/arch.png)`
- L1/L2 一行代码没动，全部增量在 L3（团队协作层）
- 零编排设计：SOP 是流程操作系统，Manager 读自然语言 Skill 决定下一步派谁。代码里没有 `if (stage === 'design') callPM()` 这种写法。要改流程，改 Skill 文本文件，不改 JS

- [ ] **Step 4: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md source/_posts/ai-agent-digital-team-4/
git commit -m "blog: add intro and architecture overview for ai-agent-digital-team-4"
```

---

### Task 4: 写全流程阶段 0-2（接缝一 + 接缝二）

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`
- Reference: `demo/xiaoquan/src/tools/team-tools.js`（接缝一）
- Reference: `demo/xiaoquan/src/agent/skill-tools-scoped.js`（接缝二）

- [ ] **Step 1: 写章节标题和引言**

写"# 全流程走一遍"章节标题，加一句引言：以 URL 短链服务为例（输入长链接生成短码，支持跳转 + 访问统计），跟着六个阶段走完一次完整交付。

- [ ] **Step 2: 写阶段 0——SOP 共创（可选）**

核心要点：
- 用户可以先在飞书和 Manager 对话，定制工作流
- Manager 加载 `sop_cocreate_guide`，几轮问答覆盖六个维度（Goal / Stages / Roles / Artifacts / Checkpoints / Retrospective）
- 最终生成新的 SOP Skill 文件保存到 `workspace/manager/skills/`
- 强调：SOP 是 `.md` 文本文件，**改流程改文本，不改 JS**

- [ ] **Step 3: 写阶段 1——需求澄清，插入接缝一**

核心要点：
- 用户在飞书发："帮我做一个 URL 短链服务，输入长链接生成短码，支持跳转和访问统计"
- Manager 判断新需求 → 加载 `sop_feature_dev` → 按四维度（goal/boundary/constraint/risk）评估需求 → 发 checkpoint 给用户确认 → 用户批准 → 创建项目目录树（needs/ design/ tech/ code/ qa/ mailboxes/ events.jsonl）→ 给 PM 发 task_assign 邮件

在"给 PM 发邮件"这里自然引出接缝一，写如下内容：

> 发邮件之后 PM 怎么知道该醒来了？

接缝一代码（来自 `demo/xiaoquan/src/tools/team-tools.js` 第 47-57 行）：

```javascript
// team-tools.js — send_mail 工具的 execute
execute: async ({to, type, subject, content, projectId}) => {
  const msgId = await mailbox.sendMail(mailboxDir, {to, from: role, type, subject, content, projectId})
  const jobId = await tasksStore.scheduleWake(cronTasksPath, {role: to, reason: 'new_mail', delayMs: 1000, projectId})
  return JSON.stringify({errcode: 0, msgId, scheduledWake: jobId, to, type})
}
```

解释：`sendMail` 内部做了两件事——写邮箱文件 + 注册 1 秒后唤醒 `to` 角色。**Agent 不需要知道"发完邮件还要通知调度器"**，工具层封装了。发邮件 = 叫人，这是消灭编排代码的关键。

- [ ] **Step 4: 写阶段 2——PM 产品设计，插入接缝二**

核心要点：
- PM 被唤醒 → 读收件箱 → 加载 `product_design` Skill → 输出产品设计文档（API 接口设计：`POST /shorten`、`GET /{code}`、`GET /{code}/stats`；数据模型；验收标准）→ 加载 `self_score` 自评 → 发 task_done 回 Manager

在 PM 加载 Skill 这里引出接缝二：

> 这里有一个容易被忽视的并发 bug。

接缝二（来自 `demo/xiaoquan/src/agent/skill-tools-scoped.js` 第 25-44 行）：

先说问题：原来的 SkillLoader 如果用模块级全局变量存 `skillsDir`，四角色并发时 PM 的 Loader 会被 Manager 的调用覆盖——PM 可能读到 Manager 的 13 个 Skill，而不是自己的 5 个。

再展示修复：

```javascript
// 改之前：全局变量，四角色并发时互相覆盖（危险）
let _skillsDir = null  // 模块级

// 改之后：每次调用传入 role，skillsDir 绑定到实例
export function loadRoleScopedSkillRegistry(workspaceRoot, role) {
  const skillsDir = path.join(workspaceRoot, role, 'skills')  // 实例绑定
  const registry = {}
  // ...从 skillsDir 读取，不依赖任何全局状态
  return registry
}
```

解释：改动只有一行——从全局变量改成函数参数派生。Manager 的 `skills_dir` 是 `workspace/manager/skills/`，PM 的是 `workspace/pm/skills/`，互不干扰。**这是从单 Agent 到多 Agent 最典型的一类 bug：一行改动，从全局到实例。**

- [ ] **Step 5: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: add flow stages 0-2 with seams 1&2 for ai-agent-digital-team-4"
```

---

### Task 5: 写全流程阶段 3-6（接缝三 + 接缝四）

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`
- Reference: `demo/xiaoquan/src/tools/workspace.js`（接缝三）
- Reference: `demo/xiaoquan/src/agent/build-team.js`（接缝四）

- [ ] **Step 1: 写阶段 3——RD 技术实现，插入接缝三**

核心要点：
- Manager 先发技术设计任务，RD 完成 `tech/tech_design.md` 后，Manager **单独再发**一条代码实现任务（两步不合并——实测合并时 Agent 容易漏掉后半段）
- RD 加载 `code_impl`，在沙盒里建目录、写代码（FastAPI/Express + SQLite，实现三个接口）、跑测试、自愈失败（最多 3 轮读 stderr → 修复 → 重跑）

在 RD 写 `code/` 这里引出接缝三：

> 四个角色共享一个项目目录，但 RD 不能动 PM 的 `design/`，QA 也不能往 `code/` 里写。怎么保证？

接缝三（来自 `demo/xiaoquan/src/tools/workspace.js` 第 18-65 行）：

```javascript
// workspace.js — 前缀 ACL
const OWNER_BY_PREFIX = {
  'needs/':  new Set(['manager']),
  'design/': new Set(['pm']),
  'tech/':   new Set(['rd']),
  'code/':   new Set(['rd']),
  'qa/':     new Set(['qa']),
}

export function checkWrite(role, relPath) {
  for (const [prefix, owners] of Object.entries(OWNER_BY_PREFIX)) {
    if (relPath.startsWith(prefix) && !owners.has(role)) {
      throw new Error(`${role} cannot write ${relPath} (owner=${[...owners]})`)
    }
  }
}
```

解释：**不靠 prompt 约束**——"不要乱写"写在 prompt 里，Agent 偶尔会忘。这里是在工具层直接 throw，调了也写不进去。PermissionError 直接返回给 Agent，让它知道这条路走不通。

- [ ] **Step 2: 写阶段 4——QA 测试 + 缺陷修复循环**

核心要点：
- Manager 给 QA 发测试设计任务，再单独发测试执行任务
- QA 做测试设计（`qa/test_plan.md`）、在沙盒跑测试
- 关键：QA 发现缺陷后**自主**给 RD 发 `task_assign` 邮件，不需要 Manager 介入
- RD 修复 → QA 再验证 → 全 pass → 发 task_done 回 Manager
- 强调：**QA→RD 这个循环没有任何 JS 代码预设**，QA 读了 `test_run` Skill 里的自然语言指引自主决策。编排逻辑在 Skill 文本里，不在代码里

- [ ] **Step 3: 写阶段 5-6——交付 + 复盘，插入接缝四**

核心要点：
- 全 pass → Manager 通过 `send_to_human(kind='delivery')` 在飞书发交付汇报 → 用户 approve → 记录 `delivered` 事件
- 复盘：Manager 给 PM/RD/QA 各发 `retro_trigger`，三个角色同时被唤醒

在"三个角色同时被唤醒"这里引出接缝四，先抛问题：

> JS 是单线程，三个角色同时唤醒有问题吗？

解释"单线程 ≠ 无并发问题"：PM 在 `await generateText(...)` 挂起时，event loop 可以调度 Manager 开始跑，两个 ReAct 循环是**交织的**（interleaved）。如果 SDK 内部有任何模块级可变状态，交织就可能污染。

接缝四（来自 `demo/xiaoquan/src/agent/build-team.js` 第 164-172 行）：

```javascript
// build-team.js — Promise 链串行化
export function wrapWithLock(agentFn) {
  let lock = Promise.resolve()
  return function lockedAgentFn(...args) {
    let resolve
    const prev = lock
    lock = new Promise(r => { resolve = r })
    return prev.then(() => agentFn(...args)).finally(() => resolve())
  }
}
```

对比 Python 版：两者锁的根因不同。Python 是 CrewAI 全局 event bus 的具体 bug（PM 的 `@before_llm_call` hook 会 fire on QA 的 LLM call，导致 system prompt 串台）；JS 版没有这个框架问题，加锁是**通用防御**——防止任何潜在的 SDK 级共享状态被 async 交织污染。**同一个接缝，两个语言的根因不同。**

- [ ] **Step 4: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: add flow stages 3-6 with seams 3&4 for ai-agent-digital-team-4"
```

---

### Task 6: 写 Demo 实录（飞书截图占位）

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`
- Create: `source/_posts/ai-agent-digital-team-4/feishu-1-request.png`（占位，作者后填）
- Create: `source/_posts/ai-agent-digital-team-4/feishu-2-checkpoint.png`（占位）
- Create: `source/_posts/ai-agent-digital-team-4/feishu-3-approve.png`（占位）
- Create: `source/_posts/ai-agent-digital-team-4/feishu-4-logs.png`（占位）
- Create: `source/_posts/ai-agent-digital-team-4/feishu-5-delivery.png`（占位）

- [ ] **Step 1: 写 Demo 实录章节标题和引言**

一句引言：上面六个阶段是设计层面的描述，下面是接上飞书跑一遍之后的真实记录。

- [ ] **Step 2: 为 5 个截图各写描述 + 占位**

按以下格式写（每个截图前 2-3 句描述，说明图里发生了什么）：

**截图 1 — 用户发起需求**
> 用户在飞书 @ 机器人，发送需求。Manager 收到消息后，判断这是一个新需求，开始走需求澄清流程。

```markdown
![用户在飞书发起需求](./ai-agent-digital-team-4/feishu-1-request.png)
```

**截图 2 — Manager 发 checkpoint**
> Manager 整理完需求，通过飞书卡片向用户确认需求细节。卡片里列出了目标、边界、约束和风险，用户需要批准或提出修改意见。

```markdown
![Manager 通过飞书卡片请用户确认需求](./ai-agent-digital-team-4/feishu-2-checkpoint.png)
```

**截图 3 — 用户批准，项目启动**
> 用户点击"批准"，Manager 收到 checkpoint_response，创建项目目录树，给 PM 发出第一封 task_assign 邮件，项目正式启动。

```markdown
![用户批准，项目正式启动](./ai-agent-digital-team-4/feishu-3-approve.png)
```

**截图 4 — 终端日志：四角色依次被唤醒**
> 终端日志展示自驱动循环的完整路径：Manager 发邮件 → CronService 1 秒后唤醒 PM → PM 处理完发邮件 → RD 被唤醒 → RD 跑完发邮件 → QA 被唤醒……没有一行 JS 代码规定这个顺序，全是 sendMail 里的 scheduleWake 驱动的。

```markdown
![终端日志展示四角色依次被唤醒](./ai-agent-digital-team-4/feishu-4-logs.png)
```

**截图 5 — 交付**
> 所有测试通过后，Manager 在飞书发出交付汇报，包含交付物清单（API 文档、数据库 schema、测试报告）和项目 ID。用户批准后，事件流记录 `delivered`，项目结束。

```markdown
![Manager 在飞书发出交付汇报](./ai-agent-digital-team-4/feishu-5-delivery.png)
```

- [ ] **Step 3: 展示关键工作区产物片段**

在截图之后，展示真实运行后 `workspace/shared/projects/url-shortener/` 下的关键文件内容片段（作者运行后替换为真实内容，现在写占位注释）：

```markdown
<!-- 运行后替换为真实的 events.jsonl 前几行 -->
<!-- 运行后替换为 mailboxes/pm.json 中 Manager→PM 的 task_assign 邮件 -->
```

- [ ] **Step 4: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: add demo section with Feishu screenshot placeholders"
```

---

### Task 7: 写接缝总结 + 结语

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`

- [ ] **Step 1: 写接缝总结（约 300 字）**

写一个小表格：

| 接缝 | 文件 | 解决的问题 |
|------|------|-----------|
| SendMail = 叫人 | team-tools.js | 发邮件自动注册唤醒，消灭显式编排代码 |
| RoleScopedSkillLoader | skill-tools-scoped.js | skillsDir 从全局变量改为实例绑定，多角色 Skill 不串台 |
| workspace 前缀 ACL | workspace.js | 共享目录按角色隔离写权限，工具层硬拦截 |
| 全局锁（Promise 链） | build-team.js | async 交织执行不污染，JS/Python 根因不同 |

表格后加一段文字：业务逻辑全在 35 个 Skill 文本文件里，JS 代码只管接缝。**新增一个角色，接缝代码几乎不用动**——在 `workspace/` 下加目录，`ROLES` 数组加一项，对应的 `OWNER_BY_PREFIX` 加一条前缀，完成。

- [ ] **Step 2: 写结语（约 150 字）**

核心要点：
- 系列四篇收尾：从"临时工"走到"会自我进化的四人团队"
- 多 Agent 系统的真正难点不在写业务逻辑，在补接缝——那些小到几行、却踩过坑才知道要加的胶水代码
- SOP 是操作系统，发邮件是调度，代码只管接缝
- 不要加"下一篇"预告（系列结束）

- [ ] **Step 3: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: add seams summary and conclusion for ai-agent-digital-team-4"
```

---

### Task 8: review-tech-article

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`（根据 review 结果修改）

- [ ] **Step 1: 调用 review-tech-article skill**

调用 `review-tech-article` skill，传入文章路径 `source/_posts/ai-agent-digital-team-4.md`，按 skill 的清单逐项检查。

- [ ] **Step 2: 修复所有 review 发现的问题**

按 review 结果逐项修复。常见问题：
- 代码片段和实际源码对不上（需核对行号）
- 某个阶段描述不够具体（需补细节）
- 截图占位描述不清晰（需改写）

- [ ] **Step 3: 提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: fix review issues in ai-agent-digital-team-4"
```

---

### Task 9: humanizer

**Files:**
- Modify: `source/_posts/ai-agent-digital-team-4.md`

- [ ] **Step 1: 调用 humanizer skill**

调用 `humanizer` skill，传入文章全文，去除 AI 写作痕迹。重点检查：破折号过度使用、三段式法则、夸大的象征意义、AI 词汇（"深刻"、"革命性"等）。

- [ ] **Step 2: 应用 humanizer 建议**

按 humanizer 输出逐条修改。注意保留代码块和表格不变。

- [ ] **Step 3: 最终提交**

```bash
git add source/_posts/ai-agent-digital-team-4.md
git commit -m "blog: humanize ai-agent-digital-team-4"
```

---

## 注意事项

1. **飞书截图**：Task 6 中的 5 个截图由作者实际运行后填入，文章写作时保留 `<!-- -->` 注释占位，不要生成假图
2. **工作区产物**：`events.jsonl` 和 `mailboxes/pm.json` 的具体内容同样由作者运行后填入
3. **代码片段准确性**：Task 4/5 中的代码片段已核对实际源码行号，写文章时直接使用，不要改动变量名
4. **write-tech-article skill**：CLAUDE.md 要求写文章时必须调用，在 Task 3 Step 1 中调用一次即覆盖整个写作过程
