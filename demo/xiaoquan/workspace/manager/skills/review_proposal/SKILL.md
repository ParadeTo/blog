---
name: review_proposal
description: "Manager 按 depth 对单条 improvement_proposal 分档审批的思考框架。当 Manager 收到 `type=retro_report` 邮件时**一定**加载本 skill。对 content.improvement_proposals[] 每条做合法性检查 + 分档（memory auto / skill+agent/soul → human）。所有'怎么批准提案'的时刻走此 skill。"
type: reference
---

# review_proposal — 单条提案分档审批

## 🚨 Critical Rules
1. **memory auto 有硬闸门**：一天累计 ≤ 3 条自动批，超出转人类。
2. **合法性先于分档**：target_file 不存在 / before_text 锚点找不到 → `retro_proposal_invalid` 跳过。
3. **skill+agent → human**：所有改 SKILL.md / agent.md 的必须人类点头。
4. **soul → human + 标红**：改 soul.md 属高风险，必须带"⚠️ 改价值观"前缀通知人类。

## 分档表

| depth | 审批 | 硬闸门 |
|-------|------|--------|
| `memory` | 自动批 | ≤ 3 条/天 |
| `skill` | 转人类 | — |
| `agent` | 转人类 | — |
| `soul` | 转人类 + 标红 | — |

## 步骤

### Step 1 — 取 proposals
读 retro_report 邮件 content 里的 proposals 路径（或内联 JSON）。

### Step 2 — 对每条做合法性检查
- target_role ∈ {manager,pm,rd,qa}？
- depth ∈ {memory,skill,agent,soul}？
- `read_shared(pid, target_file)` 能找到 before_text（严格 substring）？
- 失败 → `append_event("retro_proposal_invalid", {id, reason})` + 跳过

### Step 3 — 分档
- memory 且今日自动批 < 3：
  - `send_mail(to=target_role, type="retro_approved", subject=..., content=<单条 proposal>)`
  - `append_event("retro_approved_by_manager", {proposal_id})`
  - 今日自动批 +1
- 其他（skill / agent / soul 或 memory 超额）：
  - 加入 pending list

### Step 4 — 批量转人类
pending list 非空时一次打包：
- `send_to_human(kind="proposal_review", message=Markdown 卡片列表, project_id=..., checkpoint_id=ckpt-xxx)`
- `CheckpointStore.register(kind="proposal_review", question="审批 N 条 proposals")`
- `append_event("proposal_review_sent", {count, checkpoint_id})`

## 输出

```json
{
  "auto_approved": ["prop-1"],
  "sent_to_human": ["prop-2", "prop-3"],
  "invalid": [{"id": "prop-4", "reason": "before_text not found"}],
  "checkpoint_id": "ckpt-xxxx"
}
```
