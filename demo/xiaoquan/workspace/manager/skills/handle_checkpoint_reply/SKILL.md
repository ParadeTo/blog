---
name: handle_checkpoint_reply
description: "Manager 处理人类对 checkpoint 的回复、分档推进的思考框架。当 feishu_bridge.classify() 判定 category=checkpoint_response 时**一定**加载本 skill。分 approve / revise / reject 三种 reply_class，按 checkpoint.kind × reply_class 矩阵选下一步动作。所有'checkpoint 回复进来了'场景都走此 skill。"
type: reference
---

# handle_checkpoint_reply — checkpoint 回复分档推进

## 🚨 Critical Rules
1. **必须 resolve checkpoint**：任何分支末端都调 `CheckpointStore.resolve(checkpoint_id)`，否则下次 wake 仍被误识别。
2. **结构化 event 必须写**：每个决策都 append `checkpoint_reply_classified` + `checkpoint_approved/rejected`。
3. **revise 不是 reject**：revise 回更细的 clarification 给用户或改 artifacts，**不回退项目阶段**。

## 步骤

### Step 1 — 取 checkpoint 上下文
从 Bootstrap 里已注入的 pending_checkpoints 或读 `shared/feishu_bridge/pending.jsonl` 找到对应 `checkpoint_id`，拿到 `kind`、`project_id`。

### Step 2 — 分类回复文本
输入原文 → 三类：
- `approve`：含 "同意/批准/approve/yes/ok/确认" 之一
- `reject`：含 "拒绝/不同意/reject/no" 之一
- `revise`：其他有内容的回复（视为 revision 指令）

### Step 3 — 查动作矩阵

| checkpoint.kind | reply_class | 动作 |
|-----------------|-------------|------|
| checkpoint_request（需求确认） | approve | `send_mail(to="pm", type="task_assign", subject="产品设计")`；`append_event("checkpoint_approved")` |
| checkpoint_request（需求确认） | revise | 更新 `needs/requirements.md` + 再发 checkpoint_request |
| checkpoint_request（需求确认） | reject | `send_to_human(kind="info", message="需求已取消")` + 归档项目 |
| proposal_review（复盘审批） | approve | 按 approved_ids 发 `retro_approved` 给 target_role × N |
| proposal_review | reject | `send_mail(to=<role>, type="retro_rejected", content={reason})` |
| proposal_review | revise | `send_to_human` 澄清 |
| delivery | approve | `append_event("delivered")` + `send_to_human(kind="info","交付完成")` |
| delivery | reject | `send_mail(to="rd", type="task_assign", subject="修复交付问题 (第 N 轮)")` |

### Step 4 — 写事件 + resolve
- `append_event("checkpoint_reply_classified", {cid, reply_class})`
- `append_event("checkpoint_approved" or "checkpoint_rejected", {cid})`
- 通过 feishu_bridge 的 CheckpointStore.resolve(cid)（需通过 skill_loader 加载辅助脚本，v0 先手动记忆）

## 输出

```json
{
  "classified": "approve",
  "checkpoint_id": "ckpt-a1b2c3d4",
  "kind": "checkpoint_request",
  "next_actions": ["sent task_assign to pm", "appended checkpoint_approved"]
}
```
