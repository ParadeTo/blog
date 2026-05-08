---
name: list_available_sops
description: "Manager 扫描并列出已有 SOP 集合的 skill。当用户问'有哪些 SOP / 流程'或 Manager 自检是否需新建 SOP 时**一定**加载本 skill。扫 workspace/manager/skills/sop_* 目录，读每个 SKILL.md frontmatter 的 description，组装成列表。所有'列一下现有流程'触发都走此 skill。"
type: reference
---

# list_available_sops — 列出已有 SOP

## 🚨 Critical Rules
1. **仅列表，不创建**：新建 SOP 走 `sop_cocreate_guide + sop_write`。
2. **名字必须 sop_ 前缀**：作为列出的筛选条件。

## 步骤

### Step 1 — 扫目录
调用 `list_skills` 工具返回 manager 名下 skill 清单，过滤 `sop_` 前缀条目。

### Step 2 — 逐个读 frontmatter
对每个 sop_* SKILL.md 解析 `name / description`。

### Step 3 — 组装
按 name 字母序排列。

## 输出

```json
{
  "status": "success",
  "sops": [
    {"name": "sop_feature_dev", "description": "..."}
  ],
  "metrics": {"count": 1}
}
```

## 给用户的消息（调用方自行 send_to_human）

```markdown
当前已有 1 个 SOP：
- **sop_feature_dev**：功能开发 SOP（6 阶段）

如需新建，请发"我们来聊下 xxx 流程"。
```
