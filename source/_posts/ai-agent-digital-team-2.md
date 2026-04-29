---
title: 简单实战一下 Multi-Agent 数字员工（二）：让 Human 当甲方
date: 2026-04-28 20:00:00
tags:
  - ai
  - agent
  - multi-agent
categories:
  - ai
description: 数字团队系列第二篇。在第一篇的 Manager + PM 协作基础上，加入 Human 介入机制：单一接口原则、三个工程化介入点、human.json 二态邮箱与五阶段状态机的完整 JS 实现。
---

## 前言

[上一篇](/2026/04/27/ai-agent-digital-team-1/)搭好了数字员工团队的骨架——Manager 和 PM 各有固定身份，通过三态邮箱可靠地传递消息，整条任务链可以自动流转。

但还有一个问题没解决：**谁告诉团队做什么？做完了谁来拍板？出了问题谁来救场？**

这篇在上一篇的 demo 基础上扩展 Human 介入机制，回答这三个问题。

---

# 一、先看全图

先把这篇加入的所有文件和执行流程铺开，再逐一解释。

![](./ai-agent-digital-team-2/flow.png)

图里出现了 5 个文件，各自的职责：

| 文件 | 职责 |
|------|------|
| `human-cli.js` | Human 端命令行工具——查看消息、确认或拒绝，不阻塞系统 |
| `sop-setup.js` | SOP 共创入口——项目开始前运行一次，Manager AI 生成草稿，Human 确认后入库 |
| `run-manager.js` | Manager 入口——5 阶段状态机，每次无参数启动，自动检测当前阶段执行对应动作 |
| `run-pm.js` | PM 入口——读邮箱取任务，写产品规格文档，回邮通知 Manager（第一篇已有）|
| `digital-worker.js` | AI 驱动引擎——sop-setup.js / run-manager.js / run-pm.js 都通过它创建 AI Agent |

流程分两段：**SOP 共创**（项目开始前做一次，之后不用重复）和**正式项目**（每次新项目走一遍）。

正式项目里，每次 `node run-manager.js` 启动都是无参数重启，检测当前阶段、执行对应动作、完成后退出——Manager 从不阻塞等人。

## 运行记录

完整 demo 代码在 [GitHub](https://github.com/ParadeTo/blog/tree/master/demo/ai-agent-digital-team)。

**SOP 共创（第1次）：** Manager 分析需要建立一个"接收需求 → PM 产出规格 → Manager 验收"的 SOP，写入草稿，通知 Human。

```
[Manager] 当前状态: not_sent
  [sandbox] mailbox_cli.js → {"ok":true,"id":"msg-edd7bf8e"}
```

**Human 确认，第2次重命名入库：**

```
$ node human-cli.js respond msg-edd7bf8e y
$ node sop-setup.js
→ draft_product_design_sop.md 重命名为 product_design_sop.md，SOP 入库
```

**Phase 1 — 需求澄清：** Manager 用四维框架分析，把歧义标注出来而不是猜测。

```
[Manager] 当前阶段: 1
  [sandbox] init_workspace.js → {"ok":true,"created":[]}
  [sandbox] mailbox_cli.js → {"ok":true,"id":"msg-dc2aa76b"}

识别出 4 个待澄清项：
  - NLP 解析失败的兜底方案（手动输入 or 跳过？）
  - 提醒触发机制（每次运行检查 or 后台 cron？）
  - 优先级设定（手动指定 or 系统自动计算？）
  - "并发任务"的准确含义（100条同时存在？）
→ 写入 requirements.md，发 needs_confirm，等待 Human 确认后退出
```

**Phase 2 — 选 SOP：** 模板库里只有一个有效模板（draft_ 被过滤），直接入选。

```
[Manager] 当前阶段: 2
| product_design_sop.md  | 9.5/10 | 流程完全匹配，角色分工清晰 |
| draft_product_design_sop.md | 过滤 | draft_ 前缀不参与选择 |
→ 写入 active_sop.md，发 sop_confirm，退出
```

**Phase 4（直接退出）：** 这是状态机设计里值得关注的一个细节——检测到 PM 任务尚未完成时，Manager 不等待，直接打印提示退出。

```
[Manager] 当前阶段: 4
[Manager] 等待 PM 完成任务，请运行：node run-pm.js
```

**PM 执行：** PM 拿到带4个待澄清项的需求文档，逐一做出设计决策并标注理由。

```
4 个待澄清项全部决策：
  解析失败 → 提示手动输入，允许跳过（不强制截止时间）
  提醒机制 → 每次运行时检查，无需 cron，降低复杂度
  优先级   → 手动指定 high/medium/low，默认 medium
  并发任务 → 同时存在 100 条未完成任务作为性能基准
→ 写入 product_spec.md（4147字），回邮 task_done
```

**Phase 5 — 验收：** Manager 逐项对照，验收通过，附带3条不阻塞开发的跟进建议。

```
[Manager] 当前阶段: 5
验收结论：✅ 通过（目标/范围/约束/风险/待澄清项全部覆盖）
待跟进：--priority 默认值建议在 --help 标注 / 边界场景补测试用例 / 存储路径是否可配置
→ 写入 review_result.md
```

整条链路，`detectPhase()` 五次都判断正确，没有一次误判。

---

# 二、Human 当甲方，不当保姆

两个极端：**保姆**和**甲方**。

保姆盯着每一步——Manager 做了什么都要过目，PM 写文档要逐段审。这样 Agent 自主了个寂寞。

甲方只做三件事：**项目开始前把需求说清楚；关键方案出来时拍板确认；出了大问题出面处理**。其余时间团队完全自主。

这三件事缺了哪一件，项目都会出问题——需求没说清楚，后面所有工作方向可能都是错的；没有确认点，关键风险在末端才暴露；没有异常兜底，系统崩了你根本不知道。

三件事对应三个介入点：**需求澄清（前端）、设计确认（中端）、异常兜底（后端）**。

---

# 三、三个失控场景

不设计介入点，会发生什么？

**场景一：需求跑偏。** 你发了一句："帮我做个用户注册的产品设计。"听起来很清楚——但对 Agent 来说，歧义在哪里？邮箱还是手机号注册？要不要社交登录？验证码还是验证链接？

没有需求澄清，Agent 按自己的理解开始干，Manager 分任务，PM 写文档，Dev 开始开发——等流水线跑完，你才发现不是你想要的。返工的代价不是重来一步，是整条流水线反向退出。**进去的是垃圾，出来的是更精致的垃圾。**

**场景二：风险堆到末端。** 假设需求是清楚的，团队干了两周，PM 写完文档，Dev 写完代码，QA 测完——你看到最终结果："这个设计方案我不同意。"

让团队干了二十天再否定。这不是 Agent 的问题，是**没有中间确认点**的必然结果。把所有风险堆到末端，就是在重演瀑布模型的失败，只是在 Agent 系统里重新踩了一遍。

**场景三：静默失控。** 工具调用连续失败、任务需求有歧义消解不了、准备执行的操作超出了授权范围。如果没有异常上报机制，Agent 会怎么做？有的会一直重试，把 Token 烧光；有的会悄悄放弃，任务静默丢失。你什么都不知道，以为流水线还在正常跑着。

**没有人兜底的"自主运行"，就是"自主失控"。**

---

# 四、工程实现

## 4.1 单一接口原则

想清楚了为什么要设计介入点，先解决一个基础问题：Human 应该和哪个角色沟通？是直接找 PM 确认文档，还是通过 Manager？

**Human 永远只和 Manager 沟通，不直接接触执行层。**

实现：给 Human 设一个专属邮箱 `human.json`，**只有 Manager 有写入权限**。`mailbox_cli.js` 强制校验：

```javascript
case 'send': {
  if (args.to === 'human' && args.from !== 'manager') {
    console.log(JSON.stringify({errcode: 1, errmsg: '权限拒绝：只有 manager 可以向 human 发消息'}))
    process.exit(1)
  }
  // ...
}
```

PM 想绕过 Manager 直接联系 Human？直接报错。这条约束不靠 Agent 自觉，靠代码保证。

为什么要这么做？Manager 是任务全局上下文的持有者，执行层只有局部视角。如果 PM 直接给 Human 发消息，Human 收到的是碎片信息，根本没法做决策。而且所有人机交互都经过 Manager，出了问题，谁在什么时候基于什么信息做了什么决策，全部有据可查。

## 4.2 human.json 的二态设计

`human.json` 的消息状态和 Agent 邮箱不同——**二态，不是三态**。

第一篇讲过，Agent 邮箱用三态（`unread → in_progress → done`）处理崩溃恢复。Human 不是 Agent，不需要"正在处理中"的状态，也不会崩溃到一半。所以 `human.json` 用两个字段决定状态：

```json
{
  "id": "msg-dc2aa76b",
  "type": "needs_confirm",
  "read": false,
  "rejected": true,
  "human_feedback": "需要补充风险一节"
}
```

`read: false` → 未处理；`read: true && !rejected` → 已确认；`read: true && rejected: true` → 已拒绝（附带反馈）。

`mailbox_cli.js` 新增了 `check-human` 子命令封装这个判断，Manager 直接调用：

```javascript
run_script("mailbox/scripts/mailbox_cli.js", [
  "check-human",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--type", "needs_confirm"
])
// 返回：{"confirmed": true} 或 {"confirmed": false, "reason": "not_read"}
```

## 4.3 前端介入：需求澄清（requirements_discovery Skill）

需求阶段的核心问题不是"怎么澄清"，而是**澄清的结果没有落地**。口头说了不算，写下来、Human 确认了才算。

Manager 的 `workspace/skills/` 目录里新增了 `requirements_discovery/SKILL.md`。`digital-worker.js` 启动时会自动扫描 skills 目录，把所有 SKILL.md 文件内容注入 system prompt——Manager 看到这个 Skill 后，收到新需求时会按**四维框架**分析：目标、边界、约束、风险，缺失的标注到"待澄清"一栏，不自行猜测填充。

分析结果写入 `needs/requirements.md`，然后通过 `notify_human` Skill 发 `needs_confirm` 消息。**没有 Human 确认的需求文档，Manager 不分配任何任务**——这条硬性约束写在 `agent.md` 里，不靠 LLM 自觉，靠规则保证。

## 4.4 中端介入：SOP 共创（sop-setup.js）

需求确认之后，任务不是靠 Manager 自我发挥协调的，而是要先确定一套 SOP（标准作业流程）。SOP 回答两个问题：**谁做什么**，以及**哪些环节要 Human 确认才能继续**。

SOP 模板由 `sop-setup.js` 在项目开始前共创：

```javascript
function getSopDraftConfirmStatus() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const msg = humanInbox.filter(m => m.type === 'sop_draft_confirm').pop()
  if (!msg) return 'not_sent'
  if (!msg.read) return 'pending'
  if (msg.rejected) return 'rejected'
  return 'confirmed'
}
```

每次启动 `sop-setup.js`，它读 `human.json` 的状态决定下一步：
- `not_sent` → Manager AI 生成草稿，发 `sop_draft_confirm` 通知 Human，退出
- `pending` → 打印"等待 Human 确认"，退出
- `rejected` → Manager AI 根据反馈重新生成草稿
- `confirmed` → 把 `draft_xxx_sop.md` 重命名为 `xxx_sop.md`，正式入库

模板入库之后，每次正式项目运行时，`sop_selector` Skill 从模板库里评分选最优，写入 `active_sop.md`，再发 `sop_confirm` 等 Human 确认。

Checkpoint 设多少个合适？不是越多越好——设太多等于没设，人会开始无脑点通过。判断标准：如果这个决策错了，返工成本有多高？高的设 Checkpoint，低的让 Agent 自主处理。

## 4.5 后端介入：异常兜底（error_alert）

第三个介入点是生产系统的最后一道门，触发条件有三类：工具调用连续失败、任务执行超出授权范围、质量超过 3 轮迭代仍无法达标。

所有异常统一发 `error_alert` 类型消息到 `human.json`，内容包含：异常类型、发生位置、当前状态、建议处理方式。Human 处理后在 `human-cli.js` 里回复，Manager 下次运行时继续执行。

出错不可怕，怕的是出了错没人知道。`human.json` 就是这个团队的报警台。

## 4.6 五阶段状态机（run-manager.js）

引入 Human 介入之后，`run-manager.js` 从原来的二分支（"有没有 task_done"）扩展成了五阶段状态机：

```javascript
function detectPhase() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const managerInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'manager.json'))
  const pmInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'pm.json'))

  const taskDone = managerInbox.find(m => m.type === 'task_done' && m.status !== 'done')
  if (taskDone) return 5  // 有待验收任务

  const taskAssign = pmInbox.find(m => m.type === 'task_assign' && m.status !== 'done')
  if (taskAssign) return 4  // PM 在工作，等待

  const sopConfirm = humanInbox.filter(m => m.type === 'sop_confirm').pop()
  if (sopConfirm?.read && !sopConfirm.rejected) return 3  // SOP 已确认

  const needsConfirm = humanInbox.filter(m => m.type === 'needs_confirm').pop()
  if (needsConfirm?.read && !needsConfirm.rejected) return 2  // 需求已确认

  return 1  // 从头开始
}
```

五个阶段全部靠检查现有邮箱文件判断，不依赖任何外部参数。关键设计思路：**让系统状态完全可从文件系统重建**——Manager 随时可以重启，不需要保存任何进度，重启后扫一遍邮箱就知道在哪个阶段。

---

# 五、两个反模式

最后说两个设计陷阱。

**审批疲劳：** Checkpoint 设太多，每一步都问"确认吗？"刚开始你还认真看，后来就无脑点通过了。设太多等于没设——真正需要确认的决策也会被橡皮图章通过。

**只看 Agent 的汇报：** Agent 汇报的内容和它实际执行的，可能不是同一件事。Manager 可能在邮件里写"产品文档已通过验收"——但你去打开 `product_spec.md` 看一看，未必如此。这不是恶意，是 LLM 的幻觉。别只看邮件结论，要去看实际产出文件。

---

## 总结

这篇给第一篇的数字团队加上了"甲方视角"：

- **单一接口原则**：Human 只和 Manager 沟通，`mailbox_cli.js` 在代码层面强制执行
- **三个介入点**：需求澄清（requirements_discovery Skill）、设计确认（sop-setup.js + sop_selector）、异常兜底（error_alert 类型消息）
- **human.json 二态设计**：Human 不是 Agent，不需要三态
- **五阶段状态机**：Manager 无状态重启，靠文件系统状态驱动

下一篇打算聊聊 Agent 团队的记忆和自我改进——团队跑得越久，积累的上下文越多，怎么管理？怎么让团队越用越好？
