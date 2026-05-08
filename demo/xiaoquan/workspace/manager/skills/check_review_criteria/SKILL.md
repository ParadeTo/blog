---
name: check_review_criteria
description: "Manager 按判据决定是否插入团队评审的思考框架。Manager 收到任意 `type=task_done` 邮件、准备下一步决策时**一定**加载本 skill。综合 self_score / impact_level / 新手期 / 随机抽查 5 条判据，返回 threshold_met 布尔。任何'下一阶段 vs. 插评审'的决策都走此 skill。"
type: reference
---

# check_review_criteria — 是否插入团队评审

## 🚨 Critical Rules
1. **OR 逻辑**：5 条判据任一命中即插评审；不要当作"综合评分"用。
2. **返回值稳定**：只返回 bool 和 reasons；不发邮件、不写事件（那是调用方的事）。
3. **抽查 15% 的随机数要幂等**：用 `hash(msg_id)` 而不是 `random()`，否则复盘时复不出来。

## 判据表（任一触发 → threshold_met=True）

| # | 判据 | 阈值 |
|---|------|------|
| 1 | `impact_level` ∈ {"high","critical"} | 产出类型高风险（上线面向用户/涉钱/涉隐私） |
| 2 | `self_score < 0.70` | 角色自评偏低 |
| 3 | `breakdown.hard_constraints < 0.80` | 硬约束失分 |
| 4 | 角色在该 skill 新手期 | 完成同类任务 < 3 次 |
| 5 | 随机抽查 | `int(hashlib.md5(msg_id).hexdigest(),16) % 100 < 15` |

## 步骤

### Step 1 — 拿 task_done content
从邮件 content 读 `self_score / breakdown / skill / impact_level`（可选）。

### Step 2 — 计数角色历史（判据 4）
读 `shared/projects/*/events.jsonl`（跨项目），数最近 30 天同角色同 skill 的 task_done_received 条数。

### Step 3 — 逐条检查
对 1-5 每条 eval → 命中 reasons.append。

## 输出

```json
{
  "threshold_met": true,
  "reasons": ["self_score=0.62 < 0.70", "impact_level=high"],
  "next_action": "insert_review"
}
```
或
```json
{"threshold_met": false, "reasons": [], "next_action": "proceed_next_stage"}
```

## 调用方动作（不在本 skill）
- threshold_met=true → `append_event("decided_insert_review")` + `send_mail(type="review_request")` ×2 给"非本任务角色"
- threshold_met=false → `append_event("task_done_received")` + 推进下一阶段
