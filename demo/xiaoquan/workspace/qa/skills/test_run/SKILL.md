---
name: test_run
description: "QA 在沙盒里执行 qa/test_plan.md 所有用例、收集失败、写 defect 的 skill。当 QA 收到 type=task_assign 且 subject 含'测试执行/run tests'的邮件时**一定**加载本 skill。用 execute_code 在沙箱里真实跑测试（自动检测语言：Node.js 用 npm test，Python 用 pytest）→ 通过标 pass、失败写 qa/defects/defect_{id}.md → 汇总 qa/test_report.md + task_done。沙箱失败时才降级静态分析，但必须在报告中标注。如有 defect，顺带发 task_assign 给 RD 修复。"
type: task
---

# test_run — 执行测试

## ⚠️ 执行方式
- **优先**：调用 `run_project_tests(projectId, round)`；它会在沙箱里真实跑测试，自动写 `qa/test_report.md` / `qa/test_status.json`，失败时自动写 defect 并发给 RD
- 只有 `run_project_tests` 不可用时，才使用 `execute_code` 工具在沙箱里真实跑测试
- 写 defect 报告：使用 `write_shared(pid, "qa/defects/defect_{id}.md", content)`
- 汇总报告：使用 `write_shared(pid, "qa/test_report.md", content)`
- 发邮件：使用 `send_mail` 工具

## 🚨 Critical Rules
1. **必须先尝试沙箱执行**：不能因为"可能失败"就跳过，必须调用 `execute_code` 并观察实际结果。
1.1 **收到交付门禁触发的测试执行任务时**：必须调用 `run_project_tests`，不要只回复“待真实环境运行”。
2. **沙箱失败才能降级**：只有 `execute_code` 抛出连接错误、容器无法创建、共享目录无法挂载等工具/环境错误时，才允许改用静态分析，且报告顶部必须加 `⚠️ 降级执行` 标注。
3. **一条用例一个 defect 文件**：便于后续 RD 修复时精确对应。
4. **test_report.md 是强制交付物**：Manager 据此判断交付 or 打回。
5. **defect 文件必填 reproduce 步骤 + 期望 vs 实际**：否则 RD 修不了。
6. **测试命令失败不是沙箱失败**：缺 `requirements.txt`、依赖安装失败、pytest 非 0、断言失败、服务启动后接口返回不符合预期，都必须写 defect 并发给 RD，不能标成"沙箱不可用"。
7. **保留原始错误证据**：报告和 defect 至少保留命令、returncode、stdout/stderr 最后 80 行，不能只写"podman run failed"。
8. **外部沙箱证据可采信但要标注来源**：Manager/RD/Operator 提供完整命令和原始 pytest summary 时，可以写入报告作为"已接收沙箱证据"；不得再写"待补机内证据"。
9. **xfail/xpass 不能算通过**：pytest 即使 returncode=0，只要 summary 出现 `xfailed` 或 `xpassed`，都必须标 fail、写 defect、发 RD 修复；不得把契约关键路径用 `@pytest.mark.xfail` 留到交付。

## 步骤

### Step 1 — 读 test_plan
`read_shared(pid, "qa/test_plan.md")` 拿用例清单

### Step 1.5 — 自动测试闭环工具（首选）
调用：

```json
{"projectId":"PROJECT_ID_HERE","round":"round-1","disallowedOutcomes":["xfailed","xpassed"]}
```

工具名：`run_project_tests`

若返回 `status=pass`，确认 `qa/test_report.md` 与 `qa/test_status.json` 已写入，然后 `mark_done` 当前测试执行邮件。

若返回 `status=fail`，工具已经写 defect 并发送 RD 修复任务；你只需确认结果并 `mark_done` 当前测试执行邮件。

注意：`xfailed/xpassed` 是本 skill 定义的 QA policy，不是工具硬编码。调用 `run_project_tests` 时必须把它们放进 `disallowedOutcomes`；若手工执行，也必须按同一口径处理。

### Step 2 — 检测项目语言
使用 `execute_code` 工具检测：
```python
import os

pid = "PROJECT_ID_HERE"
code_dir = f"/workspace/shared/projects/{pid}/code"
has_package_json = os.path.exists(f"{code_dir}/package.json")
has_requirements = os.path.exists(f"{code_dir}/requirements.txt")
print("node" if has_package_json else "python")
print("has_requirements=", has_requirements)
```

### Step 3 — 跑全部测试
使用 `execute_code` 工具，根据语言选择命令：

**Node.js 项目**（检测到 package.json）：
```python
import subprocess

pid = "PROJECT_ID_HERE"
code_dir = f"/workspace/shared/projects/{pid}/code"
result = subprocess.run(
    ["bash", "-c", f"cd {code_dir} && npm install -q && npm test 2>&1 | tail -150"],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
```

**Python 项目**：
```python
import subprocess
import os

pid = "PROJECT_ID_HERE"
code_dir = f"/workspace/shared/projects/{pid}/code"
cmd = "python -m pytest -v --tb=short"
if os.path.exists(f"{code_dir}/requirements.txt"):
    cmd = "pip install -r requirements.txt -q && " + cmd
else:
    print("QA_DEFECT: missing code/requirements.txt; still running pytest with sandbox preinstalled packages")
result = subprocess.run(
    ["bash", "-c", f"cd {code_dir} && {cmd} 2>&1 | tail -150"],
    capture_output=True, text=True
)
print("RETURNCODE:", result.returncode)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
```

**沙箱连接失败时**（execute_code 报 connection refused 等错误）：
- 降级为静态分析
- 在 test_report.md 顶部加：`⚠️ 降级执行：沙箱不可用（{错误信息}），本报告为静态代码分析结果，非真实运行数据。`

**明确不能降级的情况**：
- `ERROR: Could not open requirements file`
- `ModuleNotFoundError` / `ImportError`
- `pytest` collected tests but failed assertions
- `pytest` summary 出现 `xfailed` / `xpassed`
- HTTP 4xx/5xx/302 行为与 test_plan 不一致

这些都要按 Step 4 写 defect，并按 Step 6 发给 RD 修复。

### Step 4 — 按 test_plan 逐条映射
对每个 C-XX / AC-XX：
- 测试通过 → 标 pass，附输出片段作为证据
- 失败 → 写 defect：`write_shared(pid, "qa/defects/defect_{id}.md", defect_md)`

Defect 模板：
```markdown
# Defect {C-XX}
- **用例**: ...
- **优先级**: F/H/M/L
- **Reproduce**: POST /shorten {"url": "..."}
- **期望**: 201 + shortCode
- **实际**: 500 + "internal server error"
- **栈**: （测试输出最后 30 行）
```

### Step 5 — 汇总 test_report.md
```markdown
# 测试报告
- 执行方式：沙箱真实运行 / ⚠️ 降级：静态分析（沙箱不可用）
- 执行时间：...
- 总用例：18
- 通过：16
- 失败：2

## 失败用例
- C-07（defect qa/defects/defect_c07.md）
- C-12（defect qa/defects/defect_c12.md）

## 覆盖率
78%（来自测试运行输出 / 估算）
```
`write_shared(pid, "qa/test_report.md", ...)`

### Step 6 — 发 task_done + 可选转发
1. `send_mail(to="manager", type="task_done", subject="测试执行完成", content={...}, project_id=pid)`
2. 若有 defect：`send_mail(to="rd", type="task_assign", subject="缺陷修复 / fix defects (第 N 轮)", content={"defects": ["qa/defects/defect_c07.md", ...], "test_command": "...", "returncode": 1}, project_id=pid)`
3. `mark_done(pid, <task_assign_msg_id>)`

## 输出

```json
{
  "status": "success",
  "execution_mode": "sandbox | degraded_static_analysis",
  "artifacts": [{"path": "qa/test_report.md"}, {"path": "qa/defects/defect_c07.md"}],
  "metrics": {"total": 18, "pass": 16, "fail": 2, "coverage": 0.78},
  "self_score": 0.83,
  "breakdown": {"completeness": 1.0, "self_review": 0.8, "hard_constraints": 1.0, "clarity": 0.7, "timeliness": 0.8}
}
```
