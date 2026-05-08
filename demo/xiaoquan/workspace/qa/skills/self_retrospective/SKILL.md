---
name: self_retrospective
description: "角色（PM/RD/QA）任务交付后自我复盘的思考框架（5 递进问题 + root_cause 枚举）。当任一角色收到 type=retro_trigger 的邮件时**一定**加载本 skill。回顾本 scope 内做了什么 + self_score 分布 + 为每个弱点写 improvement_proposal → 发 retro_report 回 Manager。所有'角色层自我复盘'的时刻走此 skill。"
type: reference
---

# self_retrospective — 角色自我复盘

## 🚨 Critical Rules
1. **不重算 self_score**：用本 scope 内各次 task_done 已经打的分，聚合成 distribution。
2. **每条 proposal 必须有 before_text / after_text 锚点**：否则 Manager review_proposal 会判 invalid。
3. **proposals 必须写文件**：便于 Manager 从 mail content 追溯而不是复读长 JSON。
4. **target_file 建议是自己的 skill 文件**：自我进化为主，不要改别人家里的东西。

## 5 个递进问题

1. **我做了什么？** 列 scope 内的 task_done 清单 + 关键 artifacts
2. **做得好的点？** self_score ≥ 0.85 的维度，值得沉淀/扩展
3. **做得差的点？** self_score < 0.7 的维度 + root_cause：
   - `skill_gap` — 我不知道怎么做
   - `protocol_ambiguity` — team_protocol 让我误解
   - `tool_limitation` — Tool 能力不够
   - `memory_miss` — 缺长期记忆
4. **改什么？** 每个弱点 1 条 improvement_proposal（target_role / target_file / depth / before_text / after_text / rationale）
5. **怎么验证？** 每条 proposal 附 `validation_metric`（下次同 skill self_score ≥ X）

## 步骤

### Step 1 — 拉 scope 数据
- Manager 在 retro_trigger content 里告诉你 scope（例如 "project pawdiary-001 内本角色所有任务"）
- 读 events.jsonl + mailbox 历史找到本 scope 内的 task_done 清单

### Step 2 — 写 retrospective_report（Markdown ≤ 800 字）
覆盖问题 1-3；要具体引用 artifacts / 分数 / 失败点。

### Step 3 — 生成 improvement_proposals
对每个弱点（self_score < 0.7 维度 或 用户/评审反馈过的问题）写 1 条。
**验证锚点**：写前调 `read_shared(... or file path)` 确认 before_text 能精确找到。

### Step 4 — 写 proposals 到共享区
`write_shared(pid, "qa/retro_{date}.md", json_str)` — 注意 shared/proposals 不在 OWNER_BY_PREFIX，各角色用自己 owner 前缀（pm → design/retro.md，rd → tech/retro.md，qa → qa/retro.md）

### Step 5 — 发 retro_report
```
send_mail(
  to="manager", type="retro_report",
  subject="{role} 复盘报告",
  content={
    "retrospective_report": "...markdown...",
    "improvement_proposals": [...],
    "proposals_path": "qa/retro_2026-04-21.md",
    "count": N
  },
  project_id=pid,
)
mark_done(pid, <retro_trigger_msg_id>)
```

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "qa/retro_2026-04-21.md", "kind": "retro"}],
  "metrics": {"proposals": 3, "self_score_avg": 0.78}
}
```

## 收到 retro_approved 邮件后（不在本 skill，见 agent.md）
参考 team_protocol.md 的"机械执行"条款：读 target_file → 精确 substring 匹配 before_text → 替换 after_text → 写回 → 发 retro_applied 回 Manager。不做 LLM 判断。
