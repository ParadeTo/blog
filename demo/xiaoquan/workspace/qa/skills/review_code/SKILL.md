---
name: review_code
description: "QA 从'可读性 + 测试完备性 + 异常路径处理'视角评审 RD 交付代码的 skill。当 QA 收到 type=review_request 且 subject 含'代码'的邮件时**一定**加载本 skill。抽关键文件读 + 检查每路由有单测 + 异常有 try/except + 复杂度合理 → reviews/code/qa_review.md + review_done。所有'QA 看代码'的时刻走此 skill。"
type: reference
---

# review_code — QA 视角评审代码

## 🚨 Critical Rules
1. **不是逐行 code review**：抽关键文件 + 统计指标，不当 senior 大神上课。
2. **每路由必须有对应单测**：没有就是 high issue。
3. **异常 try/except 内必须有合理 HTTP code**：不要吞异常或裸 500。

## 步骤

### Step 1 — 取关键文件
- `read_shared(pid, "tech/tech_design.md")` — 对比契约
- `read_shared(pid, "code/main.py")`
- `read_shared(pid, "code/routers/*.py")`（挑 1-2 个重点）
- `read_shared(pid, "code/tests/*.py")`

### Step 2 — 单测覆盖 checklist
对 tech_design 每个接口：
- [ ] tests/ 里能找到对应 test_ 函数
- [ ] 至少覆盖成功路径 + 1 个错误路径

### Step 3 — 异常处理 checklist
- [ ] 每个 try/except 有合理 HTTPException code
- [ ] 没有 `except Exception: pass`
- [ ] 数据库错/权限错有明确处理

### Step 4 — 复杂度 checklist
- [ ] 函数 < 50 行
- [ ] 嵌套 < 4 层
- [ ] 魔法数字 < 3 个

### Step 5 — 写报告
`write_shared(pid, "reviews/code/qa_review.md", ...)`

### Step 6 — review_done

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/code/qa_review.md"}],
  "metrics": {"verdict": "pass", "missing_tests": 0, "exception_issues": 0, "complexity_issues": 1},
  "self_score": 0.9,
  "breakdown": {...}
}
```
