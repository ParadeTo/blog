---
name: tech_design
description: "RD 技术方案 skill。当 RD 收到 type=task_assign 且 subject 含'技术方案'的邮件时，**一定**加载本 skill。读 design/product_spec.md → 选 FastAPI+SQLite 技术栈 → 按 6 节模板写 tech/tech_design.md → 发 task_done 回 Manager。把产品设计翻译成可实现蓝图时都用此 skill。"
type: reference
---

# tech_design — 技术方案设计

## 🧠 角色视角
RD 是从 spec 到 code 的桥梁。tech_design 不是"把 spec 照抄一遍"，而是提前回答"实现时会卡在哪、怎么测、怎么部署"。

## 🚨 Critical Rules
1. **技术栈锁死**：FastAPI + SQLAlchemy 2.0 + SQLite + pytest + httpx.Client，无强理由不偏离。
2. **不启 uvicorn 长进程**：测试一律 `httpx.Client(app=app)`（in-process）。
3. **分层明确**：routers / services / models / schemas / database 五层，business logic 不混入 router。
4. **每个接口都想好错误场景**：400/404/409/422/500 要在方案里点名。

## 步骤

### Step 1 — 读产品设计
`read_shared(project_id, "design/product_spec.md")` 拿完整 spec。

### Step 2 — 起草技术方案
按 6 节组装：

```markdown
# {产品名} 技术方案

## 1. 技术栈选型
- 后端：FastAPI + SQLAlchemy 2.0 + SQLite
- 前端：原生 HTML + JS + CSS（单文件，无打包）
- 测试：pytest + httpx.Client(app)

## 2. 分层架构
- `main.py` — FastAPI app + router 挂载
- `routers/{module}.py` — 薄路由层
- `services/{module}.py` — 业务逻辑
- `models/{module}.py` — SQLAlchemy ORM
- `schemas/{module}.py` — Pydantic 请求/响应模型
- `database.py` — engine + SessionLocal

## 3. 数据库 Schema
```sql
CREATE TABLE xxx (...);
```

## 4. 接口实现要点（对每个接口）
### POST /api/{resource}
- 输入校验：...（schema + 业务校验 + 错误码）
- 业务逻辑：...（步骤 + 事务边界）
- 错误场景：400 xxx / 404 xxx / 500 ...

## 5. 测试策略
- 单测覆盖目标 ≥ 80%
- 用 httpx.Client(app) 做 API 测试
- 工厂模式造测试数据，teardown 每次清表

## 6. 依赖清单（requirements.txt）
fastapi==0.115.*
sqlalchemy==2.0.*
pytest
httpx
```

### Step 3 — 写入共享区
`write_shared(project_id, "tech/tech_design.md", 正文)`。

### Step 4 — self_score + task_done
- 加载 `self_score` → 打分
- `send_mail(to="manager", type="task_done", subject="技术方案完成", content={...}, project_id=...)`
- `mark_done(project_id, msg_id)`

## 输出

```json
{
  "status": "success",
  "artifacts": [{"path": "tech/tech_design.md", "kind": "doc"}],
  "self_score": 0.85,
  "breakdown": {...},
  "metrics": {"interfaces": 6, "error_codes": 4}
}
```

## 硬约束
- 必选 FastAPI + SQLite（除非强理由）
- 必须包含"接口实现要点"章节，每接口至少 1 错误场景
- 禁止 uvicorn 长进程
