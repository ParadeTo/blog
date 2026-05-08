---
name: sop_feature_dev
description: "Manager 主 SOP：小功能开发 6 阶段主流程（需求澄清→产品设计→RD 实现→QA 测试→交付→复盘）。当收到用户'帮我做 X / 做一个 / 新功能'类新需求时**一定**加载本 skill。指导 Manager 在 6 阶段中选当前阶段 + 推进下一步 + 判断是否插入团队评审。所有 feature 类开发项目都走此 SOP。"
type: reference
kind: sop
---

# SOP: 小功能开发主流程（6 阶段）

你是 Manager。收到用户新开发需求后，按下面规则推动项目。本 SOP 覆盖完整 6 阶段。

## 阶段清单

| # | 阶段 | Owner | 本阶段产物 | 用户 Checkpoint |
|---|------|-------|-----------|----------------|
| 1 | 需求澄清 | Manager | `needs/requirements.md` | ✅ 需求定稿需用户 approve |
| 2 | 产品设计 | PM | `design/product_spec.md` | （可选评审） |
| 3 | 技术方案 + 代码实现 | RD | `tech/tech_design.md` + `code/*.py` + pytest 通过 | （可选评审） |
| 4 | 测试设计 + 执行 | QA | `qa/test_plan.md` + `qa/test_report.md` | （可选评审） |
| 5 | 交付 | Manager | `delivery_sent` 事件 | ✅ 用户验收 |
| 6 | 复盘 | Manager + 各角色 | `retro_report` 邮件链 + `retro_applied_by_*` 事件 | （memory 自动，skill/agent/soul 转用户） |

## 关键推进规则

### 阶段 1：收到用户新需求飞书消息
1. 加载 skill `requirements_guide` → 按 4 维（goal/boundary/constraint/risk）评估需求完整度
2. 缺口 > 0：用 `send_to_human(kind="info")` 问 1-2 个最关键问题
3. 缺口 = 0（或用户明确说"所有细节由你决定"/"直接推进"/"我批准任何方案"）：
   - **立刻**调 Python Tool `create_project(project_id=<短 slug>, project_name=<中文名>, needs_content=<完整 5 节需求 markdown>)`
   - 调 Python Tool `send_to_human(routing_key=<user rk>, message=<需求摘要+请确认>, kind="checkpoint_request", project_id=<pid>, checkpoint_id=<短 id>)`
   - 调 Python Tool `append_event(project_id=<pid>, action="requirements_drafted", payload={...})`

### 用户在阶段 1 回复 checkpoint
- 含"同意/批准/approve/ok" → 加载 skill `handle_checkpoint_reply`
  - `append_event("checkpoint_approved")`
  - 调 `send_mail(to="pm", type="task_assign", subject="产品设计 (第 1 轮)", content={...}, project_id=<pid>)` → PM 自动被唤醒
- 含修改意见 → 更新 `needs/requirements.md`（调 `write_shared`）+ 再发 checkpoint

### 阶段 2-4：流水线推进

**阶段切换硬规则（必须严格遵守，不能合并）**：

| 当前 task_done 来自 | 下一 task_assign | subject | 必须独立发送 |
|-------------------|-----------------|---------|-----------|
| PM（含 design/product_spec.md）| to=rd | "技术方案设计 (第 1 轮)" | ✅ 仅技术方案，不含实现 |
| RD（含 tech/tech_design.md）| to=rd | "代码实现 (第 1 轮)" | ✅ **单独再发一次** task_assign 让 RD 写 code/ + 单测 |
| RD（含 code/main.py + code/tests/）| to=qa | "测试设计 (第 1 轮)" | ✅ 仅测试设计，不含执行 |
| QA（含 qa/test_plan.md）| to=qa | "测试执行 (第 1 轮)" | ✅ **单独再发一次** task_assign 让 QA 跑 pytest |
| QA（含 qa/test_report.md 且全 pass）| — | — | 进入阶段 5 交付 |

**不要做的事**：
- 🚫 subject="技术设计与实现" — 这是一条消息做两件事，RD 会漏做实现
- 🚫 subject="测试设计与执行" — QA 会漏做执行
- 🚫 没收到 RD 的"代码实现完成"就派 QA —— code/ 目录还没产物可测
- 🚫 没收到 QA 的"测试执行完成"就发 delivery —— 等 test_report.md 生成、且无 fail

**收到每条 `type=task_done` 邮件时**：
1. 调 `read_inbox(project_id)` → 拿到 task_done
2. 加载 skill `check_review_criteria` → 按 5 条判据判 threshold_met
3. threshold_met=false（常见情况）：
   - `append_event("task_done_received", {from_role, artifacts})`
   - 调 `mark_done(pid, msg_id)`
   - 按上表 → 下一 task_assign 发送
4. threshold_met=true：`append_event("decided_insert_review")` + 发 review_request ×2 → 等 review_done → 汇总决策

### 阶段 5：交付
QA 的 test_report 到达且所有通过：
1. 调 `append_event(pid, "delivery_requested", {...})`（交付准备好）
2. 调 `send_to_human(routing_key=<用户rk>, message="交付汇报+验收请求", kind="delivery", project_id=pid, checkpoint_id="delivery-<pid>")`
3. 记录到 events 的 `delivery_sent` 动作已由 send_to_human 自动写入

用户 approve 回复（"同意/批准/验收通过"等）时：
1. `append_event(pid, "delivered", {"artifacts_summary": ..., "deliverer_approved_at": "<ts>"})` **— 这一步必须做，否则交付未完成**
2. `send_to_human(routing_key=<用户rk>, message="✅ 交付确认完成，感谢！", kind="info", project_id=pid)`
3. 告知用户如需复盘，发"复盘"触发阶段 6

### 阶段 6：复盘（用户发"复盘/团队复盘"后）
加载 skill `team_retrospective` → 产出 proposals → 加载 `review_proposal` → 分档审批。

## 关键 Tool 快查
- `create_project(project_id, project_name, needs_content)` — Manager 独占
- `send_to_human(routing_key, message, kind, project_id, checkpoint_id)` — Manager 独占
- `append_event(project_id, action, payload)` — Manager 独占
- `send_mail(to, type, subject, content, project_id)` / `read_inbox(project_id)` / `mark_done(project_id, msg_id)` — 全角色
- `read_shared(project_id, rel_path)` / `write_shared(project_id, rel_path, content)` — 全角色（按 owner 前缀）

## 硬约束
- 🚫 绝不亲自写需求 / 设计 / 代码 / 测试
- 🚫 绝不让 PM / RD / QA 直接联系用户
- ✅ 每个关键决策都 `append_event` 留痕
- ✅ 用户说"所有细节由你决定" = 视为需求 4 维已覆盖，**立即** create_project；不要再追问细节
