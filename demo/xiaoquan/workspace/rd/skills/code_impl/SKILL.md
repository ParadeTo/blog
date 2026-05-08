---
name: code_impl
description: "RD 按 tech_design.md 在沙盒里实现代码 + 单测 + 跑 pytest 通过。当 RD 收到 type=task_assign 且 subject 含'实现代码/code'的邮件时**一定**加载本 skill。五层分目录写代码 + 单测 ≥80% 覆盖 + 最多 3 次失败重试 → task_done 回 Manager。所有'开始写 feature code'的时刻走此 skill。"
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

## 步骤

### Step 1 — 读技术方案
`read_shared(project_id, "tech/tech_design.md")`

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
    ["bash", "-c", f"cd {code_dir} && pip install -r requirements.txt -q && python -m pytest -x --cov=. --cov-report=term 2>&1 | tail -60"],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
```

### Step 4 — 失败修复（≤ 3 轮）
- 读 stdout 输出，定位失败的测试和断言
- 修改代码（用 `write_shared`）
- 重跑 Step 3

### Step 5 — 发 task_done
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
