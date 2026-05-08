---
name: team_retrospective
description: "Manager 维度的跨项目团队复盘思考框架（5 递进问题 + root_cause 枚举）。当用户发'复盘'或项目交付后 24 小时自动触发时**一定**加载本 skill。读 events.jsonl + 各角色 L2 日志 + 最近 3 个项目数据 → 出 retrospective_report + improvement_proposals[]。所有'团队层面该改什么'讨论都走此 skill。"
type: reference
---

# team_retrospective — 团队复盘思考框架

## 🚨 Critical Rules
1. **5 个问题是思考顺序，不是脚本顺序**：综合产出一份报告，不要逐题答题。
2. **每条 proposal 必须有 before_text/after_text 锚点**：否则下游无法机械执行。
3. **depth 分档决定审批路径**：memory auto / skill+agent → human / soul 高风险。
4. **产出 JSON 严格对齐附录 A2 schema**：下游 review_proposal + 复盘脚本依赖此格式。

## 5 个递进问题

1. **What happened?** — events.jsonl + L2 日志回看：关键节点、耗时、评审轮数、self_score 分布
2. **Patterns?** — 查找 ≥2 次相同 root_cause / 某阶段持续慢 / 某角色 self_score 持续 < 0.7
3. **Root cause?** — 枚举（选一个或多个）：
   - `skill_gap` — 角色不知道怎么做
   - `protocol_ambiguity` — team_protocol 有歧义
   - `tool_limitation` — Tool 能力不够
   - `memory_miss` — 缺长期记忆
   - `coordination_delay` — 协作断链
4. **What to change?** — 每个 root_cause 出 1 条 `improvement_proposal`：
   - `target_role`：谁动手改
   - `target_file`：相对项目根 或 workspace/{role}/skills/.../SKILL.md
   - `depth`：memory / skill / agent / soul
   - `before_text` / `after_text`：精确锚点
   - `rationale`：为什么要这么改
5. **How to validate?** — 每条 proposal 附 `validation_metric`（如"下次 product_design self_score ≥ 0.85"）。

## 步骤

### Step 1 — 数据收集
- events.jsonl 最近 N 条（以当前 project_id 为主，可跨项目）
- 各角色 L2 日志最近 30 天（通过 `log_query.py tasks`）
- self_score 分布（通过 `log_query.py stats`）

### Step 2 — 写 retrospective_report（Markdown，≤ 1000 字）
包含：
- 本轮交付概要
- 关键亮点
- 模式/痛点
- 下一轮建议方向

### Step 3 — 生成 improvement_proposals
对每个 root_cause 写 1 条 JSON；检查 before_text 在 target_file 里能找到（先读一遍）。

### Step 4 — 写入
`write_shared(project_id, "proposals/team_retro_{yyyy-mm-dd}.json", json_str)`（shared/proposals 不在 OWNER_BY_PREFIX，无法用 write_shared；v0 实际写在 `needs/team_retro_{date}.md` 或通过新 Tool；先落 needs/）

### Step 5 — 发 proposal_review
- depth=memory 且未超 3/天：`send_mail(type="retro_approved", to=target_role)` + `append_event("retro_approved_by_manager")`
- 其他：`send_to_human(kind="proposal_review", ...)` + `CheckpointStore.register`

## 输出（RetroProposal schema）

```json
{
  "retrospective_report": "..(Markdown)...",
  "improvement_proposals": [
    {
      "id": "prop-1",
      "target_role": "pm",
      "target_file": "workspace/pm/skills/product_design/SKILL.md",
      "depth": "skill",
      "before_text": "## 4. 接口契约",
      "after_text": "## 4. 接口契约（每个接口必带 ≥1 错误场景）",
      "rationale": "本轮 RD review 反馈 3/5 接口漏错误码定义",
      "validation_metric": "下一次 product_design 评审无'接口契约'类 issue"
    }
  ]
}
```
