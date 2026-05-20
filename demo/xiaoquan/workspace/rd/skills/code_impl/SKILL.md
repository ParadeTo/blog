---
name: code_impl
description: "RD 按 tech_design.md 在沙盒里实现代码 + 单测 + 跑 pytest 通过；收到 QA 缺陷修复任务时按 defect 修代码并重测。当 RD 收到 type=task_assign 且 subject 含'实现代码/code/缺陷修复/修复缺陷/fix defects/defect'的邮件时**一定**加载本 skill。五层分目录写代码 + 单测 ≥80% 覆盖 + 最多 3 次失败重试 → task_done 回 Manager 或 QA。所有'开始写 feature code'和'修复 QA defect'的时刻走此 skill。"
type: task
---

# code_impl — 代码实现 + 单测

## ⚠️ 执行方式

- **写代码文件**：使用 `write_shared(project_id, "code/xxx.py", content)` 写入共享区
- **跑测试**：使用 `execute_code` 工具执行 Python 代码（可调 subprocess 跑 pytest）
- **发邮件**：使用 `send_mail` 工具

## 🚨 Critical Rules
1. **禁 uvicorn 长进程**：测试一律 `httpx.Client(app=app)`；打开进程=失败。
2. **覆盖率 < 70% 不交付**：必须补测试或跟 Manager 说明放宽（revise）。
3. **pytest 失败 ≤ 3 次重试**：每次失败分析 stderr，不要盲猜。
4. **requirements.txt 必写**：包含所有 import 依赖；不许"假定全局安装"。
5. **缺陷修复必须回归**：收到 QA defect 后，逐个读取 `qa/defects/*.md`，修复后跑完整 pytest；不能只修单测或只口头说明。
6. **工作根固定为 `code/`**：代码实现、缺陷修复、测试运行一律以 `/workspace/shared/projects/{projectId}/code` 为工作根。不要向人类询问 A/B、工作根、写入目录；若 `code/` 为空，直接在 `code/` 下重建完整工程。
7. **禁止用目录探测代替实现**：`ls -la`、读取目录、说明“无代码”不能作为 task_done；必须写入可运行工件（如 `code/requirements.txt`、`code/app/main.py`、`code/tests/test_*.py`、`code/run_tests.sh`）并实际跑测试。

## 步骤

### Step 1 — 读技术方案
`read_shared(project_id, "tech/tech_design.md")`

若邮件 subject/content 是缺陷修复：
- 先读 content 里的 defect 路径，例如 `qa/defects/defect_xxx.md`
- 每个 defect 都要提取 reproduce / expected / actual / stack
- 同时读对应测试文件和实现文件，确认是产品代码问题、测试断言问题，还是缺交付文件
- 若 defect 内容是 `no runnable code artifacts found under code/` 或 `detect runnable code` 失败，判定为**缺代码实现**，不需要澄清，直接进入 Step 2 在 `code/` 下补完整工程。

### Step 1.5 — 固定工作根
默认并唯一工作根：

```text
/workspace/shared/projects/{projectId}/code
```

所有 `write_shared` 的 `relPath` 必须以 `code/` 开头；所有测试命令必须 `cd /workspace/shared/projects/{projectId}/code` 后执行。

如果当前 `code/` 为空，直接写入这些最小可运行工件：
- `code/requirements.txt`
- `code/run_tests.sh`
- `code/app/__init__.py`
- `code/app/main.py`
- `code/tests/test_*.py`

不要发 clarification_request，不要问“工作根 A/B”，不要等待人类确认。

### Step 2 — 按 tech_design 写代码
对每个模块，调用 `write_shared(project_id, "code/{file}", content)` 写入：
- `code/main.py`（app + router 挂载）
- `code/database.py`（engine + SessionLocal + get_db）
- `code/models/*.py`（ORM）
- `code/schemas/*.py`（Pydantic）
- `code/routers/*.py`（薄路由层）
- `code/services/*.py`（业务）
- `code/tests/test_*.py`（每 router 一份）
- `code/requirements.txt`

### Step 3 — 跑测试
使用 `execute_code` 工具，传入以下 Python 代码：
```python
import subprocess, os

pid = "PROJECT_ID_HERE"
code_dir = f"/workspace/shared/projects/{pid}/code"
result = subprocess.run(
    ["bash", "-c", f"cd {code_dir} && bash run_tests.sh 2>&1 | tail -120"],
    capture_output=True, text=True
)
print("RETURNCODE:", result.returncode)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
```

`code/run_tests.sh` 必须自包含：
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install -q -r requirements.txt
python -m pytest -q --cov=app --cov-report=term-missing
```

### Step 4 — 失败修复（≤ 3 轮）
- 读 stdout 输出，定位失败的测试和断言
- `xfailed` / `xpassed` 视为未通过；不能靠 `@pytest.mark.xfail` 或跳过契约关键路径换取绿灯
- 修改代码（用 `write_shared`）
- 重跑 Step 3

### Step 5 — 发 task_done
初次代码实现发给 Manager；QA 缺陷修复完成后发给 QA，并在 content 中列明修复的 defect 路径与最终 pytest 结果。**必须先 send_mail 成功，再 mark_done；禁止只标记 done 不回执。**

```
send_mail(
  to="manager", type="task_done",
  subject="代码实现完成",
  content={
    "artifacts": ["code/main.py", "code/tests/...", "code/requirements.txt"],
    "metrics": {"pytest_final_status": "pass", "pytest_attempts": N, "coverage": 0.XX},
    "self_score": 0.XX, "breakdown": {...},
    "rationale": "..."
  },
  project_id=pid,
)
mark_done(pid, <task_assign_msg_id>)
```

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "code/main.py", "kind": "code"}, ...],
  "metrics": {"pytest_final_status": "pass", "pytest_attempts": 1, "coverage": 0.87},
  "self_score": 0.88,
  "breakdown": {"completeness": 1.0, "self_review": 0.95, "hard_constraints": 1.0, "clarity": 0.7, "timeliness": 0.85}
}
```
