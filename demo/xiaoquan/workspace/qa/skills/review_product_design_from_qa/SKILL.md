---
name: review_product_design_from_qa
description: "QA 从'可测性 + 验收清晰度'视角评审 PM 的 product_spec.md。当 QA 收到 type=review_request 且 subject 含'产品设计'的邮件时**一定**加载本 skill。检查 Acceptance 能否 pytest 化、模糊词是否有量化、异常路径是否定义预期 → reviews/product_design/qa_testability.md + review_done。所有'QA 看产品设计'的时刻走此 skill。"
type: reference
---

# review_product_design_from_qa — QA 视角评审产品设计

## 🚨 Critical Rules
1. **"快速/方便/美观"一律标 issue**：没有量化就无法测试。
2. **异常路径没预期 → 打回**：否则 QA 没法写测试用例。
3. **不评论功能对不对**：那是 PM 和用户的事。

## 步骤

### Step 1 — 读文件
- `read_shared(pid, "needs/requirements.md")`
- `read_shared(pid, "design/product_spec.md")`

### Step 2 — 可测性 checklist
- [ ] 每条 Acceptance 能写 pytest 断言（给 1 句伪代码证明）
- [ ] 模糊词（快/方便/易用）有量化（≤ 200ms / 3 步以内 / NPS > 8）
- [ ] 每个接口异常路径有预期 HTTP code + error_code

### Step 3 — 验收清晰度 checklist
- [ ] Acceptance ≥ 5 条
- [ ] 覆盖创建/读取/更新/删除/列表/分页/权限 至少 6 条的 4 条

### Step 4 — 写报告
```markdown
# 产品设计评审（QA 视角）
## Verdict: pass | revise
## 不可测条款
- Acceptance 3 "快速响应" → 建议改 "< 200ms (P95)"
## 缺失异常路径
- DELETE /diary/{id} 当 id 不存在时未定义预期
```
`write_shared(pid, "reviews/product_design/qa_testability.md", ...)`

### Step 5 — review_done + self_score

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/product_design/qa_testability.md"}],
  "metrics": {"verdict": "revise", "vague_terms": 3, "missing_error_paths": 2},
  "self_score": 0.85,
  "breakdown": {...}
}
```
