# Design: 数字员工系列第二篇 + Demo 扩展

**Date**: 2026-04-28  
**Topic**: ai-agent-digital-team-2（Human as 甲方）  
**Source material**: `idea/multi-agent-digital-team-2/27-human-as-client.md`  
**Reference code**: `/Users/youxingzhi/ayou/crewai_mas_demo/m4l27/`

---

## 目标

1. 在现有 JS demo（`demo/ai-agent-digital-team/`）上扩展，新增 Human 介入机制
2. 写一篇中文技术博客文章，从"三个失控场景"切入，讲三个介入点的工程实现

---

## Demo 代码设计

### 原则

- 在现有 demo 目录上直接扩展，不新建平行目录
- 保留 `digital-worker.js`、`sandbox.js`、mailbox skill 不动
- 新增文件与修改文件清晰分离

### 新增/修改文件

```
demo/ai-agent-digital-team/
├── sop-setup.js                  # 新增：SOP 共创入口（项目前运行一次）
├── human-cli.js                  # 新增：Human 端交互式 CLI
├── run-manager.js                # 修改：五阶段状态机
├── package.json                  # 修改：新增 enquirer、proper-lockfile 依赖
├── workspace/
│   ├── shared/
│   │   ├── mailboxes/
│   │   │   └── human.json        # 新增：Human 专属二态邮箱（初始为 []）
│   │   ├── needs/                # 新增目录：存放 requirements.md
│   │   └── sop/                  # 新增目录：SOP 模板库
│   └── manager/
│       └── skills/
│           ├── requirements_discovery/SKILL.md  # 新增
│           ├── sop_creator/SKILL.md             # 新增
│           ├── sop_selector/SKILL.md            # 新增
│           └── notify_human/SKILL.md            # 新增
└── workspace/manager/skills/mailbox/scripts/
    └── mailbox_cli.js            # 修改：新增 check-human 子命令 + human.json 权限校验
```

### human-cli.js

依赖：`enquirer`（交互式提示）、`proper-lockfile`（文件锁）

三种运行模式：
- `node human-cli.js`：交互式循环，每5秒轮询 human.json，有未读消息展示并等待输入
- `node human-cli.js check`：JSON 输出未读消息列表（脚本友好）
- `node human-cli.js respond <id> y/n [feedback]`：原子读写 human.json

human.json 二态设计：每条消息只有 `read: false/true`，不需要 `in_progress`（Human 不是 Agent，无需崩溃恢复）。拒绝时附加 `rejected: true` 和 `human_feedback` 字段。

### run-manager.js 五阶段状态机

通过检查文件存在性和 human.json 消息状态判断当前阶段，自动路由到对应逻辑：

| 阶段 | 触发条件 | Manager 行为 |
|------|---------|-------------|
| 1. 需求澄清 | needs_confirm 消息不存在或未确认 | requirements_discovery Skill → 写 requirements.md → 发 needs_confirm |
| 2. SOP 选择 | needs_confirm 已确认，sop_confirm 未确认 | sop_selector Skill → 复制 active_sop.md → 发 sop_confirm |
| 3. 任务分配 | sop_confirm 已确认，PM 邮箱无 task_assign | 发 task_assign 给 PM |
| 4. 等待 PM | PM 邮箱有 task_assign，manager 邮箱无 task_done | 打印等待提示，退出 |
| 5. 验收 | manager 邮箱有 task_done | 读产出物 → 写验收报告 → 标记 done |

### sop-setup.js

独立入口，项目初始化前运行一次。流程：
1. Manager 加载 sop_creator Skill → 生成 SOP 草稿到 `shared/sop/draft_*.md`
2. 发 sop_draft_confirm 给 Human
3. Human 通过 human-cli.js 确认
4. 下次运行 sop-setup.js 时检测确认状态，重命名为正式模板

### mailbox_cli.js 扩展

新增子命令 `check-human --mailboxes-dir <dir> --type <type>`：
- 返回 `{ confirmed: true }` 或 `{ confirmed: false }`

新增权限校验：`--to human --from <非manager>` 返回 `errcode: 1`

### Manager Skills（四个新增 SKILL.md）

| Skill | 类型 | 职责 |
|-------|------|------|
| requirements_discovery | reference | 四维追问框架，识别缺失信息，生成 requirements.md |
| sop_creator | reference | SOP 四要素草稿生成，发 sop_draft_confirm |
| sop_selector | task | 从模板库评分选 SOP，复制为 active_sop.md，发 sop_confirm |
| notify_human | reference | 规定何时/如何向 human.json 发消息，单一接口约束 |

---

## 文章设计

**文件名**：`ai-agent-digital-team-2.md`  
**标题**：`简单实战一下 Multi-Agent 数字员工（二）：让 Human 当甲方`  
**Tags**: ai, agent, multi-agent  
**切入角度**：失控场景驱动（先还原问题，再讲解法）

### 结构

**前言**：第一篇搭好了角色 + 通信，团队能自主运转了。但还缺一个角色：甲方。没有甲方，团队不知道做什么，做完了没人说对不对，出了问题没人兜底。

**一、甲方 vs 保姆**  
类比引入：老板和保姆的区别。甲方只做三件事（说清需求、拍板确认、出问题兜底），对应三个介入点（前端/中端/后端）。其余时间 Agent 完全自主，不打扰人。

**二、没有介入点的三个失控场景**  
- 场景1：GIGO——需求没说清，方向偏了也不知道
- 场景2：风险全堆末端——没有 checkpoint，等流程跑完才发现方向错了
- 场景3：静悄悄失控——Agent 挂了没人知道，任务夯死

**三、单一接口原则**  
Human 永远只和 Manager 沟通，PM 不能直接联系 Human（mailbox_cli.js 强制校验）。human.json 二态 vs Agent 邮箱三态：为什么 Human 不需要 in_progress。human-cli.js 为什么要独立运行而不阻塞 Manager。

**四、三个介入点的实现**  
- 4.1 需求澄清（前端）：requirements_discovery Skill + 四维框架 + 落文档才算数
- 4.2 设计确认（中端）：SOP 四要素 + sop_creator/selector + Checkpoint 设计原则（不是越多越好）
- 4.3 异常兜底（后端）：三类异常 + error_alert + 全局停止开关

**五、代码演示**  
五步完整流程，每步一个命令 + 关键代码片段 + 说明发生了什么。

**六、两个值得记住的反模式**  
- **审批疲劳**：Checkpoint 设太多，Human 开始无脑点通过，真正需要确认的反而被橡皮图章
- **Lie in the Loop**：Agent 汇报"已完成"，实际产出物不符合要求——要看文件，不要只看邮件

附：On the loop vs In the loop（Martin Fowler）——甲方的价值在于设计 SOP，而不是审每一行输出。

---

## 边界约束

- 文章不照抄原课程，用自己的例子和语言重写
- Demo 代码改写到 JS，不引入 Python 依赖
- 文章语言：中文（zh-CN）
- Demo 演示场景和第一篇保持一致（用户注册流程的产品设计）
