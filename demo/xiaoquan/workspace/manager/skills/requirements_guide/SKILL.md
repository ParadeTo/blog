---
name: requirements_guide
description: "Manager 与用户对话澄清需求的思考框架（4 维：goal/boundary/constraint/risk）。当人类消息 classify=new_requirement 时**一定**加载本 skill。逐维评估覆盖度、一次问 2-3 个问题、全覆盖后转 requirements_write。所有'帮我做 X / 新需求'触发都走此 skill。"
type: reference
---

# requirements_guide — 需求澄清 4 维框架

## 🚨 Critical Rules
1. **一次 ≤ 3 个问题**：避免刷屏；优先补最薄弱那维。
2. **问题可回答**：用封闭式（A 还是 B）或范围式（几天内？）不要开放式（你有什么想法？）。
3. **四维都覆盖才推进**：下游 RD / QA 没法读 Manager 大脑里的补丁。
4. **覆盖但未 approve 不推进**：即使四维清晰，也要走一次 checkpoint_request。

## 4 维判据

为算"已覆盖"，每维至少 1 条明确回答。

| 维 | 问什么（举例） |
|----|---------------|
| **Goal（目标）** | 核心解决哪个用户痛点？MVP 包含哪些功能（3-7 条）？谁是主用户？ |
| **Boundary（边界）** | 不做什么？MVP 时间预算？用户规模预期？ |
| **Constraint（约束）** | 技术栈是否固定？部署哪里？安全/合规要求？ |
| **Risk（风险）** | 最怕什么情况？性能/数据/依赖第三方？ |

## 步骤

### Step 1 — 读对话历史
从 Bootstrap 已注入的 routing_key 历史找到本用户最近 N 条消息。

### Step 2 — 逐维 grade
每维标 `covered | partial | missing`，列关键缺口（1 句）。

### Step 3 — 选出 1-2 维最薄弱
优先级：missing > partial，相同优先级用"依赖最多下游"排序（Goal > Constraint > Boundary > Risk）。

### Step 4 — 组装问题
1-3 个具体问题；必要时带"例如 A / B / C"引导。

### Step 5 — 发出
`send_to_human(routing_key, message, kind="info", project_id=<if_known>)`

### Step 6 — 覆盖判定
如果 Step 2 的评估"全覆盖" → **不问问题**，转下一步：
- 调 skill `requirements_write` 起草 `needs/requirements.md`
- 用 `send_to_human(kind="checkpoint_request")` 请求最终确认
- `CheckpointStore.register` 登记 pending

## 输出

若仍在问：
```json
{"action": "ask_more", "covered": ["goal"], "partial": ["boundary"], "missing": ["constraint","risk"], "question_sent": "..."}
```

若已全覆盖：
```json
{"action": "write_requirements", "covered": ["goal","boundary","constraint","risk"]}
```
