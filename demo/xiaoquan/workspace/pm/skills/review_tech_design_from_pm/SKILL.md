---
name: review_tech_design_from_pm
description: "PM 从'需求一致性 + 可验证性'视角评审 RD 的 tech_design.md。当 PM 收到 type=review_request 且 subject 含'技术方案'的邮件时**一定**加载本 skill。逐条检查 Acceptance 可否追溯 + 边界不被偷做 + 接口能否 httpx 测 → 出 reviews/tech_design/pm_consistency.md + review_done。所有'PM 看技术方案'的时刻走此 skill。"
type: reference
---

# review_tech_design_from_pm — PM 视角评审技术方案

## 🧠 角色视角
PM 关心的不是架构优雅不优雅，而是"技术方案会不会让产品 Acceptance 落空"。若有，必须拉回来谈。

## 🚨 Critical Rules
1. **逐条 Acceptance → 实现路径 map**：每条 Acceptance 必须能在 tech_design 中找到对应 endpoint / 字段 / 校验。
2. **Boundary 不做清单要反查**：如果 tech_design 里把"不做"的功能做了，是高优先级 issue。
3. **不评论架构选型**：FastAPI vs Django 之类是 RD 的事。

## 步骤

### Step 1 — 读三个文件
- `read_shared(pid, "needs/requirements.md")`
- `read_shared(pid, "design/product_spec.md")`
- `read_shared(pid, "tech/tech_design.md")`

### Step 2 — 一致性 checklist
- [ ] 需求中每条 MVP 功能点在技术方案中都有对应的接口/模型
- [ ] 每条 Acceptance 能找到验证接口（state A → API → state B）
- [ ] "不做清单"里没有被偷偷做
- [ ] 接口契约里的错误场景与产品设计里定义的一致

### Step 3 — 可验证性 checklist
- [ ] 每个接口能用 httpx.Client(app) 直接测
- [ ] 没有难测的黑盒依赖（第三方 API、外部服务、文件系统副作用）
- [ ] 数据模型 schema 满足 Acceptance 里涉及的字段

### Step 4 — 写评审报告
`write_shared(pid, "reviews/tech_design/pm_consistency.md", report)`

模板：
```markdown
# 技术方案评审（PM 视角）

## Verdict: pass | revise

## 一致性 Issues
| # | 严重度 | 条款 | 问题 | 建议 |
|---|--------|------|------|------|

## 可验证性 Issues
| # | 严重度 | 接口 | 问题 | 建议 |
|---|--------|------|------|------|

## 通过项
- Acceptance 1 → POST /diary ✅
- ...
```

### Step 5 — self_score + review_done
```python
send_mail(
  to="manager", type="review_done",
  subject="技术方案评审完成 (PM)",
  content={"verdict": "pass"|"revise", "issues_count": N, "report_path": "reviews/tech_design/pm_consistency.md", "self_score": 0.xx, "breakdown": {...}},
  project_id=pid,
)
mark_done(pid, <review_request_msg_id>)
```

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/tech_design/pm_consistency.md"}],
  "metrics": {"verdict": "revise", "critical_issues": 1, "warnings": 3},
  "self_score": 0.8,
  "breakdown": {...}
}
```
