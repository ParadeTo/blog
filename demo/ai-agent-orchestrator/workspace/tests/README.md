# 员工休假记录管理系统 — 接口测试说明

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | **18+** | 使用内置 `node:test`、`node:assert`、`fetch` |

> 无需安装任何第三方测试框架，所有依赖均为 Node.js 内置模块。

---

## 运行步骤

### 第一步：启动后端服务

```bash
node server/app.js
```

服务默认监听 `http://localhost:3000`，请确保启动成功后再执行测试。

### 第二步：运行测试

新开一个终端窗口，在项目根目录执行：

```bash
node --test tests/leaves.test.js
```

---

## 输出示例

测试通过时，终端输出类似：

```
▶ GET /api/leaves - 无参数应返回列表及统一响应结构
  ✔ GET /api/leaves - 无参数应返回列表及统一响应结构 (23ms)
▶ POST /api/leaves - 成功新建，返回201及完整字段
  ✔ POST /api/leaves - 成功新建，返回201及完整字段 (8ms)
...
ℹ tests 28
ℹ pass 28
ℹ fail 0
```

测试失败时，会打印具体的断言错误信息及行号，便于定位问题。

---

## 测试用例清单

### GET /api/leaves — 查询列表（4 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 1 | 无参数返回列表 | HTTP 200、`code=200`、`data` 为数组、`total` 为数字 |
| 2 | 按 `employee_name` 模糊筛选 | 返回结果均包含关键字 |
| 3 | 按 `leave_type` 精确筛选 | 返回结果 `leave_type` 完全匹配 |
| 4 | 按 `status` 精确筛选 | 返回结果 `status` 完全匹配 |

### POST /api/leaves — 新建申请（8 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 5 | 成功新建 | HTTP 201、`code=201`、字段完整、`days` 正确、`apply_time` 合法 ISO 8601、默认状态为"待审批" |
| 6 | 缺少 `employee_id` | HTTP 400、`code=400` |
| 7 | 缺少 `employee_name` | HTTP 400、`code=400` |
| 8 | 缺少 `leave_type` | HTTP 400、`code=400` |
| 9 | 缺少 `start_date` | HTTP 400、`code=400` |
| 10 | 缺少 `end_date` | HTTP 400、`code=400` |
| 11 | 缺少 `reason` | HTTP 400、`code=400` |
| 12 | `end_date` 早于 `start_date` | HTTP 400、`code=400` |
| 13 | `reason` 超过 200 字 | HTTP 400、`code=400` |

### GET /api/leaves/:id — 查询单条（2 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 14 | 成功查询 | HTTP 200、`code=200`、字段与创建时一致 |
| 15 | 不存在的 id | HTTP 404、`code=404` |

### PUT /api/leaves/:id — 编辑申请（4 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 16 | 成功编辑（待审批） | HTTP 200、`code=200`、字段已更新、`days` 重新计算 |
| 17 | 已批准状态禁止编辑 | HTTP 403、`code=403` |
| 18 | 已拒绝状态禁止编辑 | HTTP 403、`code=403` |
| 19 | 不存在的 id | HTTP 404、`code=404` |

### DELETE /api/leaves/:id — 删除申请（4 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 20 | 成功删除（待审批） | HTTP 200、`code=200`、再次查询返回 404 |
| 21 | 已批准状态禁止删除 | HTTP 403、`code=403` |
| 22 | 已拒绝状态禁止删除 | HTTP 403、`code=403` |
| 23 | 不存在的 id | HTTP 404、`code=404` |

### PATCH /api/leaves/:id/status — 审批（7 个用例）

| # | 用例描述 | 验证点 |
|---|----------|--------|
| 24 | 成功审批（批准） | HTTP 200、`code=200`、`status="已批准"`、`approver` 已记录 |
| 25 | 成功审批（拒绝） | HTTP 200、`code=200`、`status="已拒绝"`、`approver` 已记录 |
| 26 | 已批准状态再次审批 | HTTP 403、`code=403` |
| 27 | 已拒绝状态再次审批 | HTTP 403、`code=403` |
| 28 | `approver` 为空字符串 | HTTP 400、`code=400` |
| 29 | 缺少 `approver` 字段 | HTTP 400、`code=400` |
| 30 | 不存在的 id | HTTP 404、`code=404` |

---

## 设计说明

### 测试隔离策略

每个测试用例通过 `POST /api/leaves` 接口**独立创建**所需数据，不依赖其他用例的执行结果或执行顺序，保证用例间完全隔离。

### 数据依赖处理

需要特定状态（如"已批准"/"已拒绝"）的用例，会在用例内部完成：
1. `POST` 创建记录（得到"待审批"状态）
2. `PATCH` 变更状态
3. 执行目标操作并断言

### 辅助工具函数

| 函数 | 说明 |
|------|------|
| `request(method, path, body)` | 通用 HTTP 请求封装，返回 `{ status, body }` |
| `api.get/post/put/del/patch` | 各 HTTP 方法快捷调用 |
| `makeLeave(overrides)` | 生成合法的请求 body，支持字段覆盖 |
| `createLeave(overrides)` | 创建一条记录并断言成功，返回 `data` 对象 |

### 关键业务规则验证

- `days` = `end_date - start_date + 1`（自然日，含首尾）
- `apply_time` 须为合法 ISO 8601 格式
- 新建记录默认 `status = "待审批"`
- 仅"待审批"状态可编辑/删除/审批

---

## 常见问题

**Q：运行测试报 `fetch is not defined`？**  
A：请确认 Node.js 版本 ≥ 18，执行 `node -v` 查看。

**Q：所有用例均失败，报连接拒绝（ECONNREFUSED）？**  
A：后端服务未启动，请先执行 `node server/app.js`。

**Q：部分用例失败，提示 `创建辅助数据失败`？**  
A：`POST /api/leaves` 接口异常，请先排查后端服务日志。
