---
name: product_design
description: "PM 产品设计 skill。当 PM 收到 type=task_assign 且 subject 含'产品设计'的邮件时，**一定**加载本 skill。读 needs/requirements.md → 按 6 节模板产出完整 design/product_spec.md → 发 task_done 回 Manager。任何新的产品需求到来时都用此 skill 作为第一道工序。"
type: reference
---

# product_design — 产品设计

## 🧠 角色视角
你是产品经理，对需求负终局责任：产品上线若用户卷进来骂"这不是我要的"，责任在 PM，不在 RD。所以本阶段不能让需求有模糊点流到下游。

## 🚨 Critical Rules
1. **先问根因，再给方案**：需求文档里每个 MVP 功能点都要能追溯到 Goal 或用户场景。无来源的功能砍掉。
2. **不做清单比做清单更重要**：写 `## 6.2 明确不做` 比写 `## 6.1 必须做` 更重要。
3. **验收标准必须可机械检查**：每条 Acceptance 能写成 pytest 断言，否则不合格。
4. **接口契约给 RD 用**：数据模型字段齐全、接口含正常响应 + 至少 1 个错误分支。

## 步骤

### Step 1 — 读需求
调 `read_shared(project_id, "needs/requirements.md")` 拿需求原文；调 `read_inbox(project_id)` 确认 task_assign 消息的 content 细节。

### Step 2 — 按模板起草 spec
按下面 6 节组装 Markdown（每节必填，没有就写"无"）。

```markdown
# {产品名} 产品设计文档

## 1. 产品概述
- 一句话定义：...
- 核心价值：...

## 2. 用户场景（3 个起）
- 场景 1：...
- 场景 2：...
- 场景 3：...

## 3. 数据模型
### 实体 {EntityName}
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|

## 4. 接口契约
- `POST /api/xxx` — 入参 / 成功响应（JSON） / 错误响应（至少 1 种）
- `GET /api/xxx` — ...

## 5. 验收标准（每条能写成 pytest）
- [ ] 能 POST 创建日记，返回 201 + 新对象 id
- [ ] 列表分页默认 20，`limit>100` 返回 422
- [ ] ...

## 6. 约束与边界
### 6.1 必须做
- ...
### 6.2 明确不做
- ...（越具体越好）
```

### Step 3 — 写入共享区
`write_shared(project_id, "design/product_spec.md", 正文)`。

### Step 4 — self_score
加载 skill `self_score` → 5 维打分，得到 `{self_score, breakdown, rationale}`。

### Step 5 — 发 task_done
`send_mail(to="manager", type="task_done", subject="产品设计完成", content={json}, project_id=...)`，content 含 self_score + artifacts。

### Step 6 — 标 done
`mark_done(project_id, msg_id)` 标记自己刚处理的 task_assign 已完成。

## 输出（最终 reply 里返回 JSON 串，供 task_callback 解析）

```json
{
  "status": "success",
  "artifacts": [{"path": "design/product_spec.md", "kind": "doc"}],
  "self_score": 0.82,
  "breakdown": {
    "completeness": 1.0,
    "self_review": 0.9,
    "hard_constraints": 1.0,
    "clarity": 0.7,
    "timeliness": 0.8
  },
  "rationale": "..."
}
```

## 硬约束
- 每节必填，验收标准必须可机械检查
- 接口含至少 1 个正常 + 1 个错误
- self_score 必须在 task_done 邮件里带上
