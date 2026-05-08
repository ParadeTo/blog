---
name: sop_cocreate_guide
description: "Manager 与用户共创新 SOP 的思考框架（6 维：goal/stages/roles/artifacts/checkpoints/retro）。当人类消息 classify=sop_cocreate 且当前没有匹配 SOP 时**一定**加载本 skill。逐维问 1-2 个问题、全覆盖后转 sop_write。所有'制定/定义一个新流程'对话都走此 skill。"
type: reference
---

# sop_cocreate_guide — SOP 共创 6 维框架

## 🚨 Critical Rules
1. **一次 ≤ 2 维**：用户负担；6 维要分 3-4 轮问完。
2. **先问 Goal 再问 Stages**：目标不清时问阶段是空中楼阁。
3. **共创 ≠ 由 AI 全定**：用户的判断优先；AI 只填空、提醒漏维、反刍总结。

## 6 维问题模板

| 维 | 关键问题 |
|----|---------|
| **Goal** | 这个 SOP 解决什么问题？成功的样子是什么？ |
| **Stages** | 分几个阶段？每阶段 entry / exit 条件？ |
| **Roles** | 每阶段谁主做？谁 review？ |
| **Artifacts** | 每阶段产出哪些文件/邮件？存哪？ |
| **Checkpoints** | 哪几步必须让人类确认？ |
| **Retrospective** | 什么时候复盘？怎么触发？ |

## 步骤

### Step 1 — 读历史
从 Bootstrap 已注入的用户对话历史找最近 SOP 相关内容。

### Step 2 — 评估覆盖
每维标 covered / partial / missing。

### Step 3 — 问 1-2 个最薄弱维
用对比式（"A 还是 B？"）或范围式（"每周一次还是每次交付后？"）。

### Step 4 — 发出
`send_to_human(routing_key, message=问题 Markdown, kind="info", project_id="")`

### Step 5 — 全覆盖后
- 组装一版"这是我理解的 SOP 草稿：..." 给用户预览
- `send_to_human(kind="checkpoint_request")` 等 approve
- approve 后调 skill `sop_write` 序列化

## 输出

仍在问：
```json
{"action": "ask_more", "covered": [...], "missing": [...], "question_sent": "..."}
```

覆盖完、待 approve：
```json
{"action": "await_approval", "covered": ["goal","stages","roles","artifacts","checkpoints","retro"], "checkpoint_id": "ckpt-xxx"}
```
