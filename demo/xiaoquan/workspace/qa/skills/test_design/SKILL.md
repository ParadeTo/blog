---
name: test_design
description: "QA 产出完整测试计划的 skill（风险分析 + 功能用例 + 边界/异常 + 端到端）。当 QA 收到 type=task_assign 且 subject 含'测试设计'的邮件时**一定**加载本 skill。读 requirements + product_spec + tech_design → 按 5 节模板写 qa/test_plan.md → task_done。所有'新项目 QA 开始测试设计'的时刻走此 skill。"
type: reference
---

# test_design — 测试计划设计

## 🚨 Critical Rules
1. **风险分级必须 F/H/M/L**：Fatal / High / Medium / Low 四档，不是 1-5 数字。
2. **每条用例必须可自动化**：手工测试在本项目不合格。
3. **端到端 ≥ 1 个 happy path + 1 个 error path**。

## 步骤

### Step 1 — 读三文件
- `needs/requirements.md` — 验收标准
- `design/product_spec.md` — 接口契约
- `tech/tech_design.md` — 错误码定义

### Step 2 — 风险分析
对每个接口 × 典型场景 矩阵打分：

```markdown
## 1. 风险点
| 风险 | 影响面 | 优先级 |
|------|--------|--------|
| 数据库并发写冲突 | 丢失日记 | H |
| 分页 limit 无上限 | 拖死数据库 | M |
```

### Step 3 — 功能用例表
```markdown
## 3. 功能用例
| ID | 场景 | 输入 | 预期 | 优先级 |
|----|------|------|------|--------|
| C-01 | 创建日记 成功 | POST /diary {title,...} | 201 + id | F |
| C-02 | 创建 缺 title | POST /diary {} | 422 | H |
| C-03 | 分页 limit=200 | GET /diary?limit=200 | 422 or cap=100 | M |
```

### Step 4 — 边界 + 异常
```markdown
## 4. 边界与异常
- 空字符串 title / 最大长度 1000 / 特殊字符（emoji/引号）
- 并发创建同一 id（UUID 冲突）
- DB 断链（模拟 sqlite lock）
```

### Step 5 — 端到端 smoke
```markdown
## 5. E2E Smoke
- S-01 创建→查单条→更新→删除 全链路
- S-02 分页越界 + 404 错误恢复
```

### Step 6 — 写入 + task_done
`write_shared(pid, "qa/test_plan.md", 正文)` → `send_mail(to="manager", type="task_done", ...)`

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "qa/test_plan.md", "kind": "doc"}],
  "metrics": {"total_cases": 18, "F": 2, "H": 5, "M": 8, "L": 3, "e2e": 2},
  "self_score": 0.86,
  "breakdown": {...}
}
```
