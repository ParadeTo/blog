---
name: sop_creator
type: reference
description: 与 Human 共同设计 SOP 模板。基于四要素框架生成草稿，通知 Human 审阅。
---

# SOP 创建

## SOP 四要素框架

| 要素 | 说明 |
|------|------|
| 角色分工 | 哪些角色参与？各自职责边界 |
| 执行步骤 | 按顺序列出，每步有明确输入/输出 |
| Checkpoint | 哪些环节需要 Human 确认才能继续 |
| 质量标准 | 每步的验收标准 |

## 工作流程

### Step 1 — 生成 SOP 草稿

用 `writeFile` 写入共享工作区宿主机路径 `sop/draft_{名称}_sop.md`：

```markdown
# {名称} 标准操作流程（SOP）

## 角色分工
| 角色 | 职责 |
|------|------|
| Manager | 初始化工作区，澄清需求，分配任务，验收产出 |
| PM | 读取需求，产出产品规格文档，回邮通知 |
| Human | 确认需求文档，审阅关键交付物 |

## 执行步骤
| 步骤 | 执行者 | 操作 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | Manager | 初始化工作区 + 需求澄清 | 用户原始需求 | requirements.md |
| 2 | Human | 确认需求文档 | requirements.md | 确认/拒绝 |
| 3 | Manager | 选 SOP 并确认 | SOP 模板库 | active_sop.md |
| 4 | Human | 确认 SOP 选择 | active_sop.md | 确认/拒绝 |
| 5 | Manager | 分配任务给 PM | requirements.md | task_assign 邮件 |
| 6 | PM | 产出产品规格文档 | requirements.md | product_spec.md |
| 7 | Manager | 验收 PM 产出 | product_spec.md | review_result.md |

## Checkpoint
| Checkpoint | 触发时机 | 确认内容 |
|------------|---------|---------|
| CP1 | 需求文档完成后 | 需求是否准确完整 |
| CP2 | SOP 选定后 | 流程设计是否合理 |

## 质量标准
| 交付物 | 验收标准 |
|--------|---------|
| 需求文档 | 包含目标/边界/约束/风险四维度 |
| 产品文档 | 包含用户故事和验收标准 |
```

### Step 2 — 通知 Human 审阅

用 notify_human Skill 发送 sop_draft_confirm 消息：
- 主题：「SOP 草稿待审阅」
- 内容：草稿路径

## 草稿命名规范

- 草稿：`draft_{名称}_sop.md`（如 `draft_product_design_sop.md`）
- Human 确认后重命名：`{名称}_sop.md`（如 `product_design_sop.md`）
