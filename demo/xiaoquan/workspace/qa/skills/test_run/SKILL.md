---
name: test_run
description: "QA 在沙盒里执行 qa/test_plan.md 所有用例、收集失败、写 defect 的 skill。当 QA 收到 type=task_assign 且 subject 含'测试执行/run tests'的邮件时**一定**加载本 skill。按 test_plan 跑 pytest → 通过标 pass、失败写 qa/defects/defect_{id}.md → 汇总 qa/test_report.md + task_done。如有 defect，顺带发 task_assign 给 RD 修复。所有'QA 真的跑测试'的时刻走此 skill。"
type: task
---

# test_run — 执行测试

## ⚠️ 执行方式
- 跑 pytest：使用 `execute_code` 工具执行 Python subprocess 代码
- 写 defect 报告：使用 `write_shared(pid, "qa/defects/defect_{id}.md", content)`
- 汇总报告：使用 `write_shared(pid, "qa/test_report.md", content)`
- 发邮件：使用 `send_mail` 工具

## 🚨 Critical Rules
1. **一条用例一个 defect 文件**：便于后续 RD 修复时精确对应。
2. **test_report.md 是强制交付物**：Manager 据此判断交付 or 打回。
3. **defect 文件必填 reproduce 步骤 + 期望 vs 实际**：否则 RD 修不了。

## 步骤

### Step 1 — 读 test_plan
`read_shared(pid, "qa/test_plan.md")` 拿用例清单

### Step 2 — 跑全部测试
使用 `execute_code` 工具，传入：
```python
import subprocess

pid = "PROJECT_ID_HERE"
code_dir = f"/workspace/shared/projects/{pid}/code"
result = subprocess.run(
    ["bash", "-c", f"cd {code_dir} && pip install -r requirements.txt -q && python -m pytest -v --tb=short 2>&1 | tail -120"],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
```

### Step 3 — 按 test_plan 逐条映射
对每个 C-XX：
- pytest 通过 & 场景符合预期 → 标 pass
- 失败 → 写 defect：`write_shared(pid, "qa/defects/defect_{id}.md", defect_md)`

Defect 模板：
```markdown
# Defect {C-XX}
- **用例**: ...
- **优先级**: F/H/M/L
- **Reproduce**: POST /diary {invalid}...
- **期望**: 422 + error_code=invalid_input
- **实际**: 500 + "internal server error"
- **栈**: （pytest 输出最后 30 行）
```

### Step 4 — 汇总 test_report.md
```markdown
# 测试报告
- 执行时间：...
- 总用例：18
- 通过：16
- 失败：2

## 失败用例
- C-07（defect qa/defects/defect_c07.md）
- C-12（defect qa/defects/defect_c12.md）

## 覆盖率
78%（来自 pytest --cov）
```
`write_shared(pid, "qa/test_report.md", ...)`

### Step 5 — 发 task_done + 可选转发
1. `send_mail(to="manager", type="task_done", subject="测试执行完成", content={...}, project_id=pid)`
2. 若有 defect：`send_mail(to="rd", type="task_assign", subject="修复缺陷 (第 N 轮)", content={"defects": ["qa/defects/defect_c07.md", ...]}, project_id=pid)`
3. `mark_done(pid, <task_assign_msg_id>)`

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "qa/test_report.md"}, {"path": "qa/defects/defect_c07.md"}],
  "metrics": {"total": 18, "pass": 16, "fail": 2, "coverage": 0.78},
  "self_score": 0.83,
  "breakdown": {"completeness": 1.0, "self_review": 0.8, "hard_constraints": 1.0, "clarity": 0.7, "timeliness": 0.8}
}
```
