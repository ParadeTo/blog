---
name: review_tech_design_from_qa
description: "QA 从'接口可测性 + 错误码完整性'视角评审 RD 的 tech_design.md。当 QA 收到 type=review_request 且 subject 含'技术方案'的邮件时**一定**加载本 skill。检查每接口错误码齐全、schema 能 httpx 直接调、响应格式一致 → reviews/tech_design/qa_testability.md + review_done。所有'QA 看技术方案'的时刻走此 skill。"
type: reference
---

# review_tech_design_from_qa — QA 视角评审技术方案

## 🚨 Critical Rules
1. **错误码必须 4 档**：至少有 400 / 404 / 422 / 500 四档定义（或合理子集）。
2. **响应 envelope 一致**：若一部分返回 `{data: ...}` 一部分裸返回 → 打回。
3. **不评论业务**：业务归 PM。

## 步骤

### Step 1 — 读文件
- `read_shared(pid, "design/product_spec.md")`
- `read_shared(pid, "tech/tech_design.md")`

### Step 2 — 错误码 checklist
对每个接口：
- [ ] 400（参数格式错）
- [ ] 404（资源不存在）
- [ ] 422（业务校验失败）
- [ ] 500（系统错，至少定义返回 envelope）

### Step 3 — 一致性 checklist
- [ ] 所有成功响应 schema 一致（envelope or 裸 JSON，不混用）
- [ ] 所有错误响应 schema 一致（`{detail: "..."}` or `{error: {code, message}}`）
- [ ] 字段命名风格一致（snake_case vs camelCase）

### Step 4 — 写报告 + review_done

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/tech_design/qa_testability.md"}],
  "metrics": {"verdict": "revise", "missing_error_codes": 4, "inconsistencies": 1},
  "self_score": 0.84,
  "breakdown": {...}
}
```
