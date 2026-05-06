# 设计文档：简单实战一下 Multi-Agent 数字员工（三）：自我进化

**日期**：2026-05-06  
**系列**：ai-agent-digital-team（第三篇）  
**前置**：article 1（角色+邮箱）、article 2（Human 介入）

---

## 一、目标

写第三篇博客文章，主题为数字员工团队的自我进化机制。同时将 Python 参考 demo（`/Users/youxingzhi/ayou/crewai_mas_demo/m4l28`）改写为 JavaScript，作为文章配套 demo，在现有 JS demo（`demo/ai-agent-digital-team/`）基础上扩展，不破坏前两篇 demo 的可运行性。

---

## 二、JS Demo 设计

### 2.1 整体原则

旁路系统：只加文件，不改现有架构。现有文件的唯一改动点：
- `digital-worker.js`：`send_mail` 工具执行时，若 `to="human"` 自动写 L1 日志（AOP）
- `run-manager.js`：新增 phase 6，处理 `retro_report` 邮件

### 2.2 新增文件

```
demo/ai-agent-digital-team/
├── log-ops.js              # 三层日志读写库（L1/L2/L3）
├── log-query.js            # CLI 查询脚本，Agent 通过 run_script 调用
├── seed-logs.js            # 生成 7 天历史演示数据并重置 baseline
├── run-scheduler.js        # 调度触发（双条件检查 → 发 retro_trigger 邮件）
│
└── workspace/
    ├── shared/
    │   ├── logs/
    │   │   ├── l1_human/   # L1：人类纠正（每条一个 JSON 文件）
    │   │   ├── l2_task/    # L2：任务摘要（{agent_id}_{task_id}.json）
    │   │   └── l3_react/   # L3 旧格式（seed 数据用）
    │   └── proposals/      # 复盘提案 JSON
    │       └── approved/   # 审批通过后移入
    │
    ├── pm/
    │   ├── sessions/               # L3 v6：*_raw.jsonl + index.jsonl
    │   ├── baselines/              # 可重置的 baseline 文件
    │   └── skills/
    │       └── self_retrospective/SKILL.md
    │
    └── manager/
        └── skills/
            ├── team_retrospective/SKILL.md
            └── review_proposal/SKILL.md
```

### 2.3 三层日志规范

| 层级 | 路径 | 写入时机 | 保留策略 |
|------|------|---------|---------|
| L1 | `logs/l1_human/{msg_id}.json` | `send_mail(to="human")` 时自动追加 | 永久 |
| L2 | `logs/l2_task/{agent_id}_{task_id}.json` | run 脚本任务完成后写入 | 90 天 |
| L3 旧 | `logs/l3_react/{agent_id}/{task_id}/step_{n}.json` | seed 时写模拟数据 | 30 天 |
| L3 v6 | `pm/sessions/{session_id}_raw.jsonl` + `index.jsonl` | seed + digital-worker 运行时追加 | 30 天 |

L2 记录结构：
```json
{
  "agent_id": "pm",
  "task_id": "t001",
  "task_desc": "用户登录功能产品设计文档",
  "result_quality": 0.40,
  "duration_sec": 180,
  "error_type": "checkpoint_rejected",
  "timestamp": "2026-04-30T10:00:00Z"
}
```

### 2.4 log-query.js CLI 接口

Agent 通过 `run_script` 工具调用，输出纯 JSON：

```bash
node log-query.js stats      --agent-id pm --days 7
node log-query.js tasks      --agent-id pm --days 7 --sort quality_asc --limit 5
node log-query.js steps      --task-id t001 --agent-id pm
node log-query.js l1         --days 7 --keyword "移动端"
node log-query.js all-agents --days 7
```

CLI 只做数据查询，不做判断，不排序推荐——判断留给 Agent LLM。

### 2.5 Scheduler 触发条件

双条件（与 Python 版一致）：
- 距上次复盘 > 24 小时
- 最近 24 小时内 L2 任务数 ≥ 5

满足则发 `retro_trigger` 邮件给 PM，发 `team_retro_trigger` 给 Manager。状态持久化到 `workspace/shared/.last_retro.json`。

### 2.6 复盘提案格式（RetroOutput）

```json
{
  "retrospective_report": {
    "agent_id": "pm",
    "period": "2026-04-28 ~ 2026-05-04",
    "summary": "设计文档任务质量偏低，根因是 product_design Skill 缺少移动端检查步骤",
    "findings": [{
      "pattern": "3/8 任务被退回，全是设计文档类",
      "evidence_task_ids": ["t001", "t003", "t006"],
      "l1_corroboration": "3条 L1 纠正记录均指向移动端适配缺失"
    }]
  },
  "improvement_proposals": [{
    "root_cause": "sop_gap",
    "target_file": "skills/product_design/SKILL.md",
    "current_behavior": "文档生成流程未包含多端适配检查",
    "proposed_change": "在需求读取步骤后增加多端检查步骤",
    "before_text": "1. **需求来源**：从 requirements.md 读取原始需求",
    "after_text": "1. **需求来源**：从 requirements.md 读取原始需求\n2. **多端检查**：如需求涉及用户界面，必须明确桌面端/移动端差异并分别设计",
    "expected_improvement": "设计文档 checkpoint 通过率从 62% 提升至 85%+",
    "evidence": ["t001", "t003", "t006"]
  }]
}
```

约束：`evidence` 非空、一次最多 3 条提案、`before_text` 非空。

### 2.7 三档 HITL 审批

| 档位 | target_file 特征 | 审批方式 |
|-----|---------|---------|
| 档 1 | memory.md | Manager 自动批准 + 闸门（3条/天） |
| 档 2 | skills/*.md / agent.md | Manager LLM 预审 → 转 Human |
| 档 3 | soul.md | Human 必审（邮件确认） |

审批路由：`PM → Manager → Human → Manager → PM`，沿用现有邮箱系统，新增 message type：`retro_report`、`retro_approved`、`retro_rejected`、`retro_applied`。

### 2.8 Seed 数据

模拟 PM 运行一周：8 条 L2 任务（3 条低质量，均为设计文档类，被 checkpoint_rejected），3 条 L1 人类纠正记录（均指向移动端适配），3 条 L3 失败任务步骤。每次 `node seed-logs.js` 先清空旧数据再重新生成，并重置 `workspace/pm/skills/product_design/SKILL.md` 到 baseline。

### 2.9 运行顺序

```bash
# 1. 生成历史数据
node seed-logs.js

# 2. 触发复盘（满足双条件则发邮件）
node run-scheduler.js

# 3. PM 执行自我复盘
node run-pm.js

# 4. Manager 审批提案
node run-manager.js

# 5. PM 收到审批结果，执行文件替换
node run-pm.js
```

---

## 三、文章结构

约 4000-5000 字，结构如下：

```
前言
  → 回顾前两篇，引出"系统不会自己变好"的问题

一、为什么需要自我进化
  → 三个必然发生的问题（重复错误/冗余工具路径/协作问题被误归因）
  → 五步闭环：记录→复盘→提案→落地→验证

二、三层日志：复盘的原料
  → 各层记什么、生命周期、为什么不合并
  → AOP 落地示例（send_mail 里一行代码）

三、复盘方法论：从"出了问题"到"改哪一行"
  → 复述式反思的陷阱（Reflexion 论文）
  → 漏斗模型五个递进问题
  → root_cause 枚举约束

四、自我复盘实战（PM 走一遍）
  → Skill = 思考框架，不是操作手册
  → log-query CLI 设计
  → 完整推理链 + RetroOutput JSON 示例

五、团队复盘与三档 HITL
  → Manager 补视野盲区
  → 三档审批设计与理由（soul 改错无法自我纠正）
  → 邮箱闭环路由

六、跑一遍（demo 演示）
  → 五条命令的输出截图

七、小结
```

---

## 四、约束与风险

- **不改现有 demo 运行路径**：article 1 & 2 的 `npm run manager` / `npm run pm` 依然可以独立运行
- **baseline 文件必须存在**：`seed-logs.js` 依赖 `workspace/pm/baselines/` 下的原始文件，需提前创建
- **提案执行是字符串匹配**：`before_text` 找不到就报错，不猜测，不硬改
