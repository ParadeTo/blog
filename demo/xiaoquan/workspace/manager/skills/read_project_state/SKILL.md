---
name: read_project_state
description: "Manager 推断当前项目处于哪一阶段的思考框架。Manager 每次被唤醒 kickoff 第二步**一定**加载本 skill。读 events.jsonl + 4 个邮箱状态 + 共享文件存在性，返回 stage ∈ {requirements, product_design, tech_design, rd_impl, qa_test_design, qa_test_run, delivery, retrospective, unknown}。任何'现在应该做什么'的决策前都用此 skill 核对阶段。"
type: reference
---

# read_project_state — 推断项目阶段

## 🚨 Critical Rules
1. **本 skill 只判断阶段，不动作**：返回 JSON 后由调用方（Manager）决定下一步。
2. **信号从上到下，取第一个命中**：不要组合多个信号。
3. **unknown 不是失败**：碰到 unknown 正确动作是 send_to_human 问用户。

## 判据表（从上到下）

| # | 信号（读文件/邮箱/事件） | stage |
|---|------|------|
| 1 | `shared/projects/` 下无此 pid 目录 | `no_project` |
| 2 | events 只有 `project_created` | `requirements` |
| 3 | 存在 `needs/requirements.md` 但无 `design/product_spec.md` | `product_design` |
| 4 | 存在 `design/product_spec.md` 但无 `tech/tech_design.md` | `tech_design` |
| 5 | 存在 `tech/tech_design.md` 但 `code/` 目录空 | `rd_impl` |
| 6 | `code/` 有代码但无 `qa/test_plan.md` | `qa_test_design` |
| 7 | 有 `qa/test_plan.md` 但无 `qa/test_report.md` | `qa_test_run` |
| 8 | 最新事件 ∈ {`delivery_requested`,`delivered`} | `delivery` |
| 9 | 最新事件以 `retro_` 开头 | `retrospective` |
| 10 | 以上都不匹配 | `unknown` |

## 步骤

### Step 1 — 确定 project_id
从唤醒消息或最近 task_done 邮件里找。找不到 → 返回 `no_project_id`。

### Step 2 — 文件存在性检查
对下面 4 个文件各调一次 `read_shared(project_id, path)`，成功返回 True，FileNotFoundError 返回 False：
- `needs/requirements.md`
- `design/product_spec.md`
- `tech/tech_design.md`
- `qa/test_plan.md`
- `qa/test_report.md`

### Step 3 — 判断阶段
按判据表匹配。

## 输出

```json
{
  "stage": "product_design",
  "current_project_id": "pawdiary-001",
  "signals": {
    "has_requirements": true,
    "has_product_spec": false,
    "has_tech_design": false,
    "has_code": false,
    "has_test_plan": false,
    "has_test_report": false,
    "latest_event": "requirements_drafted"
  },
  "blockers": []
}
```

## 示例

**Input**: 刚被 heartbeat 唤醒，manager inbox 有一条来自 pm 的 task_done "产品设计完成"。
**Output**:
```json
{"stage": "tech_design", "current_project_id": "pawdiary-001", "signals": {"has_product_spec": true, "has_tech_design": false}, "blockers": []}
```
