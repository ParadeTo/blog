---
name: review_test_design
description: "RD 从'边界完备性 + 可自动化'视角评审 QA 的 qa/test_plan.md。当 RD 收到 type=review_request 且 subject 含'测试设计'的邮件时**一定**加载本 skill。检查边界/异常用例齐全 + 用例能 pytest 化 + 覆盖目标合理 → reviews/test_design/rd_boundary.md + review_done。所有'RD 看测试设计'的时刻走此 skill。"
type: reference
---

# review_test_design — RD 视角评审测试设计

## 🚨 Critical Rules
1. **边界用例必须成对出现**：空 + 单元素 + 最大 + 超限；缺一即不合格。
2. **异常用例要对齐接口契约**：错误码在 tech_design 里声明的，test_plan 里必须覆盖。
3. **覆盖率目标不能低于 70%**：< 70% 即要求 revise。

## 步骤

### Step 1 — 读两文件
- `read_shared(pid, "tech/tech_design.md")`
- `read_shared(pid, "qa/test_plan.md")`

### Step 2 — 边界 checklist
对每个数据模型字段：
- [ ] 空值 / NULL
- [ ] 最大长度
- [ ] 特殊字符（Unicode / 引号 / HTML）
- [ ] 并发写同一条

### Step 3 — 异常 checklist
对每个接口错误码（400/404/409/422/500）：
- [ ] test_plan 有对应用例
- [ ] 错误响应 body schema 被断言

### Step 4 — 覆盖率评估
- 目标 < 70%？→ revise
- 70-79%？→ warning
- ≥ 80%？→ ok

### Step 5 — 写报告 + review_done
`write_shared(pid, "reviews/test_design/rd_boundary.md", report)`
`send_mail(to="manager", type="review_done", subject="测试设计评审完成 (RD)", content=..., project_id=pid)`

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/test_design/rd_boundary.md"}],
  "metrics": {"verdict": "revise", "missing_boundaries": 3, "missing_error_cases": 2},
  "self_score": 0.78,
  "breakdown": {...}
}
```
