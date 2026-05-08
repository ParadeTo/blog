---
name: sop_write
description: "Manager 把共创后的 SOP 落盘成一个新的 reference skill。当 sop_cocreate_guide 判定 coverage_complete + 用户 approve 时**一定**加载本 skill。产出带阶段表 + 推进规则 + 复盘触发的 SKILL.md，存入 needs/sop_draft.md（v0）或 workspace/manager/skills/sop_{name}/（v1）。所有'把对话沉淀成可复用流程'的时刻走此 skill。"
type: reference
---

# sop_write — SOP 序列化为 skill

## 🚨 Critical Rules
1. **v0 先落项目共享区**：写到 `needs/sop_draft.md`（受 write_shared 权限约束）；v1 再加 WriteSkillTool。
2. **frontmatter 三要素齐全**：name / description（触发源+能力+产出）/ type=reference。
3. **必须有阶段表 + 推进规则 + 复盘触发**：少一个不叫 SOP。

## 模板

```markdown
---
name: sop_{topic}
description: "{触发源}触发。{能力简述}。产出：{主要交付物/事件}。"
type: reference
---

# sop_{topic} — {人话名字}

## 阶段表
| # | 阶段 | 角色 | 交付物 | HITL 检查 |
|---|------|------|--------|----------|
| 1 | 需求 | manager | needs/requirements.md | ✅ 必须 |
| 2 | 产品设计 | pm | design/product_spec.md | 可选 |
| ... |

## 推进规则
- 阶段 N → N+1 的条件：...
- 评审插入时机：check_review_criteria 返回 threshold_met=true

## 复盘触发
- 自动：阶段 {N} delivered 后 24 小时
- 手动：用户发"复盘"
```

## 步骤

### Step 1 — 组装 Markdown
从 sop_cocreate_guide 6 维对话提取数据，填入模板。

### Step 2 — 写入
v0：`write_shared(project_id, "needs/sop_draft.md", content)`（注意：Manager 可写 needs/）

### Step 3 — 通知用户
`send_to_human(routing_key, message="SOP 草稿已写入 needs/sop_draft.md，后续我按此推进", kind="info", project_id=...)`

### Step 4 — 附加事件（v0.5，新增 action 时扩展 VALID_ACTIONS）
目前 `VALID_ACTIONS` 不含 `sop_drafted`，改用 `requirements_drafted` 或不写事件。

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "needs/sop_draft.md", "kind": "sop_draft"}],
  "metrics": {"stages": 6, "checkpoints": 2}
}
```

## v1 扩展（待实现）
新 `WriteSkillTool(role, skill_name, content)` 直接写 `workspace/{role}/skills/sop_{name}/SKILL.md`；需配套 SkillLoader 热重载清缓存。
