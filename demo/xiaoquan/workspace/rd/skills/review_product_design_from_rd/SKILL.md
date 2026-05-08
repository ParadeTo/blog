---
name: review_product_design_from_rd
description: "RD 从'技术可行性 + 实现成本'视角评审 PM 的 product_spec.md。当 RD 收到 type=review_request 且 subject 含'产品设计'的邮件时**一定**加载本 skill。评估功能是否 FastAPI+SQLite 栈内实现、给估时、标黑洞、建议砍/延后 → reviews/product_design/rd_feasibility.md + review_done。所有'RD 看产品设计'的时刻走此 skill。"
type: reference
---

# review_product_design_from_rd — RD 视角评审产品设计

## 🚨 Critical Rules
1. **估时要具体**：以小时为单位；"有难度"不是估时。
2. **黑洞显性化**：批量导入、全文搜索、WebSocket、第三方 OAuth 等需明确点名。
3. **建议砍/延后要给出 MVP 能否成立的判断**：不能只说"建议延后"。

## 步骤

### Step 1 — 读文件
- `read_shared(pid, "needs/requirements.md")`
- `read_shared(pid, "design/product_spec.md")`

### Step 2 — 逐条 MVP 功能评估
按下面矩阵打分：

| 指标 | 评估方式 |
|------|----------|
| 可行性（1-5） | 栈内可直接实现 → 5；需新库 → 3；需基础设施 → 1 |
| 实现估时（h） | 以"一个熟悉该栈的中级 RD 独立完成"为基准 |
| 风险（L/M/H） | 性能、数据一致性、外部依赖 |

### Step 3 — 识别黑洞
关键词清单：
- 批量导入/导出 / 大文件处理
- 全文搜索 / 模糊匹配
- 实时推送 / WebSocket
- 第三方 OAuth / 支付接入
- 多端协同编辑

命中 → 写到 Issues。

### Step 4 — 写评审报告
```markdown
# 产品设计评审（RD 视角）

## Verdict: pass | revise
## 总估时：X 人时

## 逐条评估
| 功能 | 可行性 | 估时(h) | 风险 | 备注 |
|------|--------|---------|------|------|

## 技术黑洞
- ...

## 建议（砍 / 延后 / 改方案）
- ...
```
`write_shared(pid, "reviews/product_design/rd_feasibility.md", report)`

### Step 5 — review_done + self_score
同其他 review skill。

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "reviews/product_design/rd_feasibility.md"}],
  "metrics": {"verdict": "revise", "total_estimate_hours": 24, "blackholes": 2, "suggestions": 3},
  "self_score": 0.82,
  "breakdown": {...}
}
```
