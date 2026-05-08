# Design: ai-agent-digital-team-4 — 把四个机制装配成一个团队

Date: 2026-05-08
Series: 简单实战一下 Multi-Agent 数字员工（四）

## 背景

系列第四篇，也是最后一篇。前三篇各解决了一个维度：
- 第一篇：角色定义（workspace 四件套）+ 三态邮箱通信
- 第二篇：Human as 甲方（三个介入点 + 单一接口原则）
- 第三篇：自我进化（三层日志 + 五问复盘 + 三档审批）

本篇把四个机制装进同一个进程，用一个真实项目（URL 短链服务）跑完整的六阶段交付。重点不在业务逻辑，在**拼装接缝**——从单 Agent 到多 Agent 团队，最难的是那些看起来小、踩过坑才知道要加的胶水代码。

Demo 代码为 JavaScript/Node.js 版（`/demo/xiaoquan/`），通过飞书真实接入并演示。Demo 项目为 **URL 短链服务**（输入长链接生成短码，支持跳转 + 访问统计）。

## 文章定位

- **核心洞察**：从单 Agent 到团队，难的不是业务逻辑，是接缝
- **主要内容**：接缝代码拆解（精选 4 个）+ 全流程演示（六阶段）
- **结构方式**：流程驱动，接缝在"遇到问题的地方"自然插入，不预先列举
- **不包含**：how to run / 安装步骤（放 GitHub README）

## 文章结构

### 一、前言（约 300 字）

承接前三篇，点出今天的挑战：四个机制各自能跑，拼在一起呢？  
以"招了四个能干的人，协作一团糟"类比引出核心问题：**拼装的接缝才是真正的工程挑战**。

### 二、架构鸟瞰（约 200 字 + 分层图）

三层架构图：
- L1 基础设施层（Runner / CronService / 飞书）
- L2 记忆层（四件套 Bootstrap，原样继承）
- L3 团队协作层（四角色 + 8 个工具 + 邮箱 + 事件流，本篇新增）

强调：**L1 / L2 一行代码没动**，全部增量在 L3。

点出零编排设计：**SOP 是流程操作系统**，Manager 读自然语言 Skill 决定下一步。代码里没有 `if stage === 'design' → callPM()` 这种写法。要改流程，改 Skill 的自然语言文件，不改 JS。

### 三、全流程六阶段（约 2500 字，主体）

以 URL 短链服务项目为主线，4 个接缝在对应阶段自然插入。

#### 阶段 0：SOP 共创（可选）

用户在飞书与 Manager 对话定制工作流，Manager 生成新 SOP Skill 文件。强调 SOP 是文件，改流程不改代码。

#### 阶段 1：需求澄清 → **接缝一：SendMail = 叫人**

Manager 判断新需求 → 走 `sop_feature_dev` → 整理需求 → 发 checkpoint 给用户确认 → 用户批准 → 创建项目目录树 → 给 PM 发邮件。

**插入接缝一**（team-tools.js）：`sendMail` 工具内部自动调 `scheduleWake`，1 秒后 CronService 唤醒 PM。发邮件即触发下一角色。没有一行 JS 代码规定"发完邮件要通知调度器"——工具层封装了。

```javascript
// team-tools.js — sendMail 工具的 execute
const msgId = sendMail(workspaceRoot, {to, from: role, type, subject, content, projectId})
const jobId = await scheduleWake(cronTasksPath, {role: to, reason: 'new_mail', delayMs: 1000, projectId})
return JSON.stringify({errcode: 0, msgId, scheduledWake: jobId, to})
```

#### 阶段 2：PM 产品设计 → **接缝二：RoleScopedSkillLoader**

PM 被唤醒 → 读收件箱 → 加载 `product_design` Skill → 输出产品设计文档 → 自评 → 发回 Manager。

**插入接缝二**（skill-tools-scoped.js）：原来的 SkillLoader 用模块级全局变量存 `skillsDir`，四角色并发时 PM 的 Loader 被 Manager 的调用覆盖，PM 可能读到 Manager 的 Skill。改动只有一行：从全局变量改成实例属性，绑定到 `workspace/{role}/skills/`。

```javascript
// 改之前：全局变量，四角色并发时互相覆盖
let _skillsDir = null  // 模块级，危险

// 改之后：每次调用传入 role，构造时绑定
export function loadRoleScopedSkillRegistry(workspaceRoot, role) {
  const skillsDir = path.join(workspaceRoot, role, 'skills')  // 实例级
  // ...
}
```

这是从单 Agent 到多 Agent 最典型的 bug：一行改动，从全局到实例。

#### 阶段 3：RD 技术实现 → **接缝三：workspace 权限隔离**

Manager 先发技术设计任务，RD 完成后再单独发代码实现任务（**两步，不合并**——实测合并时 Agent 容易漏掉后半段）。RD 在沙盒里写代码、跑测试、自愈失败（最多 3 轮）。

**插入接缝三**（workspace.js）：前缀 ACL 硬拦截。`design/` 只有 PM 能写，`tech/` 和 `code/` 只有 RD，`qa/` 只有 QA。不靠 prompt 约束，工具层直接 throw。

```javascript
const OWNER_BY_PREFIX = {
  'needs/':   new Set(['manager']),
  'design/':  new Set(['pm']),
  'tech/':    new Set(['rd']),
  'code/':    new Set(['rd']),
  'qa/':      new Set(['qa']),
}

export function checkWrite(role, relPath) {
  for (const [prefix, owners] of Object.entries(OWNER_BY_PREFIX)) {
    if (relPath.startsWith(prefix) && !owners.has(role)) {
      throw new Error(`${role} cannot write ${relPath}`)
    }
  }
}
```

#### 阶段 4：QA 测试 + 缺陷修复循环

QA 做测试设计、在沙盒跑测试，发现缺陷后**自主**给 RD 发 `task_assign` 邮件。RD 修复 → QA 再验证 → 全 pass → 发 task_done 回 Manager。

强调：QA→RD 这个循环没有任何 JS 代码预设，QA 读了 `test_run` Skill 里的自然语言指引自主决策。**编排逻辑在 Skill 文本里，不在代码里。**

#### 阶段 5-6：交付 + 复盘 → **接缝四：全局锁**

交付后 Manager 触发复盘，给 PM/RD/QA 各发 `retro_trigger`，三个角色同时被唤醒。

**插入接缝四**（build-team.js）：引出用户的好问题——"JS 不是单线程吗，为什么要锁？"

解释：单线程 ≠ 无并发问题。当 PM 的 ReAct 循环在 `await generateText(...)` 挂起时，event loop 可以调度 Manager 开始跑。两个角色的循环是**交织的**，任何 SDK 级模块状态都可能被污染。`wrapWithLock` 用 Promise 链串行化：

```javascript
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

对比 Python 版：锁的原因不同。Python 是 CrewAI 全局 event bus 的具体 bug（PM 的 hook 会 fire on QA 的 LLM call）；JS 是 async 并发的通用防御。**同一个接缝，两个语言的根因不同。**

### 四、Demo 实录（飞书截图 + 关键产物）

以飞书真实对话展示完整流程。**预留 5 个截图占位**，作者跑完后填入：

1. `feishu-1-request.png` — 用户在飞书 @ 机器人发起需求
2. `feishu-2-checkpoint.png` — Manager 发飞书卡片请用户确认需求
3. `feishu-3-approve.png` — 用户回复"批准"，项目启动
4. `feishu-4-logs.png` — 终端日志，看到 team:pm / team:rd / team:qa 依次被唤醒
5. `feishu-5-delivery.png` — Manager 在飞书发交付汇报

每个截图前配 2-3 句描述，即使图未填也能读懂上下文。

截图后展示真实工作区产物片段：
- `events.jsonl` 关键行（项目事件链）
- `mailboxes/pm.json` 片段（Manager→PM 邮件）
- PM 生成的 `product_spec.md` 首段

### 五、接缝总结（约 300 字）

四个接缝对应四类问题：

| 接缝 | 文件 | 解决的问题 |
|------|------|-----------|
| SendMail = 叫人 | team-tools.js | 消灭显式编排代码，工具层封装调度 |
| RoleScopedSkillLoader | skill-tools-scoped.js | 多角色 Skill 不串台 |
| workspace 前缀 ACL | workspace.js | 共享目录不越权，工具层硬拦截 |
| 全局锁（Promise 链） | build-team.js | async 交织执行不污染 |

业务逻辑全在 Skill 文本文件里，JS 代码只管接缝。**新增一个角色，接缝代码几乎不用动**——加 `workspace/新角色/` 目录就行，ROLES 数组加一项。

### 六、结语（约 150 字）

系列四篇收尾：从"临时工"到"会自我进化的四人团队"。多 Agent 系统的真正难点不在写业务逻辑，在补接缝——那些小到几行、却踩过坑才知道要加的胶水代码。SOP 是操作系统，发邮件是调度，代码只管接缝。

## 关键决策记录

- **不含 how-to-run 章节**：安装和运行细节放 GitHub README，文章聚焦设计和演示
- **精选 4 个接缝**（非全部 9 个）：SendMail=叫人 / RoleScopedSkillLoader / workspace ACL / 全局锁，对应最典型的四类拼装问题
- **流程驱动结构**：接缝在遇到问题处插入，比预先列举更有说服力
- **Demo 飞书实拍**：作者自行运行并截图，文章预留 5 个占位
- **JS vs Python 锁的差异**：作为文章亮点之一，点出两者根因不同

## 文件说明

- 文章路径：`source/_posts/ai-agent-digital-team-4.md`
- 素材目录：`source/_posts/ai-agent-digital-team-4/`（存放图片和截图）
- Demo 代码：`demo/xiaoquan/`
- 关键源码文件：
  - `demo/xiaoquan/src/tools/team-tools.js`（接缝一）
  - `demo/xiaoquan/src/agent/skill-tools-scoped.js`（接缝二）
  - `demo/xiaoquan/src/tools/workspace.js`（接缝三）
  - `demo/xiaoquan/src/agent/build-team.js`（接缝四）
