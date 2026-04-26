# 员工休假记录管理系统 — API 接口规范文档

> 版本：1.0.0 | 日期：2025-07-01 | 作者：架构设计师

---

## 目录

1. [全局约定](#1-全局约定)
2. [接口总览](#2-接口总览)
3. [GET /api/leaves — 查询列表](#3-get-apileaves--查询列表)
4. [POST /api/leaves — 新建记录](#4-post-apileaves--新建记录)
5. [GET /api/leaves/:id — 查询单条](#5-get-apileavesid--查询单条)
6. [PUT /api/leaves/:id — 编辑记录](#6-put-apileavesid--编辑记录)
7. [DELETE /api/leaves/:id — 删除记录](#7-delete-apileavesid--删除记录)
8. [PATCH /api/leaves/:id/status — 变更审批状态](#8-patch-apileavesidstatus--变更审批状态)
9. [错误码速查表](#9-错误码速查表)
10. [枚举值定义](#10-枚举值定义)

---

## 1. 全局约定

### 1.1 基础信息

| 项目 | 值 |
|------|----|
| Base URL | `http://localhost:3000` |
| 接口前缀 | `/api` |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |

### 1.2 请求规范

- 所有请求 `Content-Type` 须为 `application/json`（GET/DELETE 除外）
- 路径参数 `:id` 为 UUID v4 字符串

### 1.3 统一响应结构

**成功响应**（单条记录）：

```json
{
  "code": 200,
  "data": { /* LeaveRecord 对象 */ },
  "message": "success"
}
```

**成功响应**（列表）：

```json
{
  "code": 200,
  "data": [ /* LeaveRecord 数组 */ ],
  "total": 10,
  "message": "success"
}
```

**错误响应**：

```json
{
  "code": 400,
  "data": null,
  "message": "错误描述信息"
}
```

### 1.4 LeaveRecord 完整字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID v4，系统生成 |
| `employee_id` | string | 员工工号 |
| `employee_name` | string | 员工姓名 |
| `leave_type` | string(enum) | 休假类型，见[枚举值定义](#10-枚举值定义) |
| `start_date` | string | 开始日期，格式 `YYYY-MM-DD` |
| `end_date` | string | 结束日期，格式 `YYYY-MM-DD` |
| `days` | number | 休假天数，系统自动计算 |
| `apply_time` | string | 申请时间，ISO 8601 格式，系统自动生成 |
| `status` | string(enum) | 审批状态，见[枚举值定义](#10-枚举值定义) |
| `approver` | string | 审批人姓名，审批前为空字符串 |
| `reason` | string | 申请理由，最多 200 字 |

---

## 2. 接口总览

| 序号 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 1 | `GET` | `/api/leaves` | 查询休假记录列表（支持筛选） |
| 2 | `POST` | `/api/leaves` | 新建休假申请 |
| 3 | `GET` | `/api/leaves/:id` | 查询单条休假记录 |
| 4 | `PUT` | `/api/leaves/:id` | 编辑休假记录（仅限"待审批"） |
| 5 | `DELETE` | `/api/leaves/:id` | 删除休假记录（仅限"待审批"） |
| 6 | `PATCH` | `/api/leaves/:id/status` | 变更审批状态（待审批 → 已批准/已拒绝） |

---

## 3. GET /api/leaves — 查询列表

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `GET` |
| 请求路径 | `/api/leaves` |
| 描述 | 获取所有休假记录，支持多条件组合筛选；多个筛选条件之间为 AND 关系 |

### 请求参数（Query String）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `employee_name` | string | ❌ 选填 | 按员工姓名**模糊匹配**（包含即命中，不区分大小写） |
| `leave_type` | string | ❌ 选填 | 按休假类型**精确匹配**，枚举值见[第 10 节](#10-枚举值定义) |
| `status` | string | ❌ 选填 | 按审批状态**精确匹配**，枚举值见[第 10 节](#10-枚举值定义) |

> 不传任何参数时，返回全量记录列表。

**请求示例：**

```
GET /api/leaves?employee_name=张&leave_type=年假&status=待审批
```

### 成功响应

**HTTP 状态码：** `200 OK`

```json
{
  "code": 200,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "employee_id": "EMP001",
      "employee_name": "张三",
      "leave_type": "年假",
      "start_date": "2025-07-10",
      "end_date": "2025-07-14",
      "days": 5,
      "apply_time": "2025-07-01T09:30:00.000Z",
      "status": "待审批",
      "approver": "",
      "reason": "家庭旅游，提前申请年假。"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "employee_id": "EMP003",
      "employee_name": "张伟",
      "leave_type": "年假",
      "start_date": "2025-07-20",
      "end_date": "2025-07-22",
      "days": 3,
      "apply_time": "2025-07-01T10:15:00.000Z",
      "status": "待审批",
      "approver": "",
      "reason": "个人事务处理。"
    }
  ],
  "total": 2,
  "message": "success"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| `leave_type` 枚举值非法 | `400` | `400` | `leave_type 参数非法，合法值为：年假/病假/事假/婚假/产假/陪产假/丧假` |
| `status` 枚举值非法 | `400` | `400` | `status 参数非法，合法值为：待审批/已批准/已拒绝` |

```json
{
  "code": 400,
  "data": null,
  "message": "leave_type 参数非法，合法值为：年假/病假/事假/婚假/产假/陪产假/丧假"
}
```

### 业务规则

- 筛选条件均为可选，不传则不过滤该维度
- `employee_name` 使用模糊匹配，输入"张"可匹配"张三"、"张伟"等
- `leave_type` 和 `status` 使用精确匹配，传入非法枚举值返回 400
- 返回结果按 `apply_time` 降序排列（最新申请在前）

---

## 4. POST /api/leaves — 新建记录

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `POST` |
| 请求路径 | `/api/leaves` |
| 描述 | 新建一条休假申请记录，系统自动生成 `id`、`apply_time`、`days`，`status` 默认为"待审批" |

### 请求体（Request Body）

| 字段名 | 类型 | 必填 | 约束 | 说明 |
|--------|------|------|------|------|
| `employee_id` | string | ✅ | 非空 | 员工工号 |
| `employee_name` | string | ✅ | 非空 | 员工姓名 |
| `leave_type` | string | ✅ | 枚举值 | 休假类型，见[第 10 节](#10-枚举值定义) |
| `start_date` | string | ✅ | `YYYY-MM-DD`，合法日期 | 休假开始日期 |
| `end_date` | string | ✅ | `YYYY-MM-DD`，合法日期，须 `>= start_date` | 休假结束日期 |
| `reason` | string | ✅ | 非空，≤ 200 字 | 申请理由 |

> `id`、`days`、`apply_time`、`status`、`approver` 均由系统自动处理，**请求体中无需传入**。

**请求示例：**

```json
{
  "employee_id": "EMP001",
  "employee_name": "张三",
  "leave_type": "年假",
  "start_date": "2025-07-10",
  "end_date": "2025-07-14",
  "reason": "家庭旅游，提前申请年假。"
}
```

### 成功响应

**HTTP 状态码：** `201 Created`

```json
{
  "code": 201,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_id": "EMP001",
    "employee_name": "张三",
    "leave_type": "年假",
    "start_date": "2025-07-10",
    "end_date": "2025-07-14",
    "days": 5,
    "apply_time": "2025-07-01T09:30:00.000Z",
    "status": "待审批",
    "approver": "",
    "reason": "家庭旅游，提前申请年假。"
  },
  "message": "申请提交成功"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| 必填字段缺失 | `400` | `400` | `employee_id 为必填项` |
| `leave_type` 枚举值非法 | `400` | `400` | `leave_type 非法，合法值为：年假/病假/事假/婚假/产假/陪产假/丧假` |
| `start_date` 格式错误 | `400` | `400` | `start_date 格式错误，须为 YYYY-MM-DD` |
| `end_date` 早于 `start_date` | `400` | `400` | `end_date 不能早于 start_date` |
| `reason` 超过 200 字 | `400` | `400` | `reason 不能超过 200 个字符` |

```json
{
  "code": 400,
  "data": null,
  "message": "end_date 不能早于 start_date"
}
```

### 业务规则

- `id`：由后端生成 UUID v4，全局唯一
- `apply_time`：由后端注入当前服务器时间（ISO 8601）
- `days`：后端计算，`days = end_date - start_date + 1`（含首尾，自然日）
- `status`：固定初始化为 `待审批`，客户端不可指定
- `approver`：初始化为空字符串 `""`

---

## 5. GET /api/leaves/:id — 查询单条

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `GET` |
| 请求路径 | `/api/leaves/:id` |
| 描述 | 根据记录 ID 查询单条休假记录的完整信息 |

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | ✅ | 休假记录的 UUID |

**请求示例：**

```
GET /api/leaves/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 成功响应

**HTTP 状态码：** `200 OK`

```json
{
  "code": 200,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_id": "EMP001",
    "employee_name": "张三",
    "leave_type": "年假",
    "start_date": "2025-07-10",
    "end_date": "2025-07-14",
    "days": 5,
    "apply_time": "2025-07-01T09:30:00.000Z",
    "status": "已批准",
    "approver": "李四",
    "reason": "家庭旅游，提前申请年假。"
  },
  "message": "success"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| 记录不存在 | `404` | `404` | `记录不存在，id: a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

```json
{
  "code": 404,
  "data": null,
  "message": "记录不存在，id: a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 业务规则

- 无论记录处于何种状态，均可查询
- `id` 不存在时返回 404，不返回空对象

---

## 6. PUT /api/leaves/:id — 编辑记录

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `PUT` |
| 请求路径 | `/api/leaves/:id` |
| 描述 | 编辑指定休假记录的内容，**仅允许编辑状态为"待审批"的记录** |

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | ✅ | 休假记录的 UUID |

### 请求体（Request Body）

| 字段名 | 类型 | 必填 | 约束 | 说明 |
|--------|------|------|------|------|
| `employee_id` | string | ✅ | 非空 | 员工工号 |
| `employee_name` | string | ✅ | 非空 | 员工姓名 |
| `leave_type` | string | ✅ | 枚举值 | 休假类型 |
| `start_date` | string | ✅ | `YYYY-MM-DD`，合法日期 | 休假开始日期 |
| `end_date` | string | ✅ | `YYYY-MM-DD`，合法日期，须 `>= start_date` | 休假结束日期 |
| `reason` | string | ✅ | 非空，≤ 200 字 | 申请理由 |

> `id`、`apply_time`、`status`、`approver` 不可通过此接口修改。

**请求示例：**

```json
{
  "employee_id": "EMP001",
  "employee_name": "张三",
  "leave_type": "年假",
  "start_date": "2025-07-10",
  "end_date": "2025-07-16",
  "reason": "旅游行程延长，申请调整结束日期。"
}
```

### 成功响应

**HTTP 状态码：** `200 OK`

```json
{
  "code": 200,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_id": "EMP001",
    "employee_name": "张三",
    "leave_type": "年假",
    "start_date": "2025-07-10",
    "end_date": "2025-07-16",
    "days": 7,
    "apply_time": "2025-07-01T09:30:00.000Z",
    "status": "待审批",
    "approver": "",
    "reason": "旅游行程延长，申请调整结束日期。"
  },
  "message": "编辑成功"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| 记录不存在 | `404` | `404` | `记录不存在，id: {id}` |
| 记录状态非"待审批" | `403` | `403` | `仅"待审批"状态的记录可以编辑，当前状态：已批准` |
| 必填字段缺失 | `400` | `400` | `reason 为必填项` |
| `end_date` 早于 `start_date` | `400` | `400` | `end_date 不能早于 start_date` |
| `reason` 超过 200 字 | `400` | `400` | `reason 不能超过 200 个字符` |

```json
{
  "code": 403,
  "data": null,
  "message": "仅\"待审批\"状态的记录可以编辑，当前状态：已批准"
}
```

### 业务规则

- **状态限制**：仅 `status === '待审批'` 的记录可被编辑；`已批准` 或 `已拒绝` 状态返回 403
- **不可变字段**：`id`、`apply_time`、`status`、`approver` 在编辑时保持不变，即使请求体中包含这些字段也会被忽略
- **天数重算**：编辑后 `days` 由后端根据新的 `start_date` 和 `end_date` 重新计算

---

## 7. DELETE /api/leaves/:id — 删除记录

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `DELETE` |
| 请求路径 | `/api/leaves/:id` |
| 描述 | 删除指定休假记录，**仅允许删除状态为"待审批"的记录** |

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | ✅ | 休假记录的 UUID |

**请求示例：**

```
DELETE /api/leaves/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 成功响应

**HTTP 状态码：** `200 OK`

```json
{
  "code": 200,
  "data": null,
  "message": "删除成功"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| 记录不存在 | `404` | `404` | `记录不存在，id: {id}` |
| 记录状态非"待审批" | `403` | `403` | `仅"待审批"状态的记录可以删除，当前状态：已批准` |

```json
{
  "code": 403,
  "data": null,
  "message": "仅\"待审批\"状态的记录可以删除，当前状态：已批准"
}
```

### 业务规则

- **状态限制**：仅 `status === '待审批'` 的记录可被删除；`已批准` 或 `已拒绝` 状态返回 403
- **前端确认**：前端在调用此接口前须弹出确认对话框，由用户二次确认后方可发起请求（后端不感知此逻辑）
- **不可恢复**：删除操作直接从内存 Map 中移除，不可撤销

---

## 8. PATCH /api/leaves/:id/status — 变更审批状态

### 基本信息

| 项目 | 值 |
|------|----|
| 请求方法 | `PATCH` |
| 请求路径 | `/api/leaves/:id/status` |
| 描述 | 对指定休假记录进行审批操作，将状态从"待审批"变更为"已批准"或"已拒绝"，并记录审批人 |

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | ✅ | 休假记录的 UUID |

### 请求体（Request Body）

| 字段名 | 类型 | 必填 | 约束 | 说明 |
|--------|------|------|------|------|
| `status` | string | ✅ | 枚举值：`已批准` 或 `已拒绝` | 审批结果 |
| `approver` | string | ✅ | 非空 | 审批人姓名 |

**请求示例（批准）：**

```json
{
  "status": "已批准",
  "approver": "李四"
}
```

**请求示例（拒绝）：**

```json
{
  "status": "已拒绝",
  "approver": "李四"
}
```

### 成功响应

**HTTP 状态码：** `200 OK`

```json
{
  "code": 200,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_id": "EMP001",
    "employee_name": "张三",
    "leave_type": "年假",
    "start_date": "2025-07-10",
    "end_date": "2025-07-14",
    "days": 5,
    "apply_time": "2025-07-01T09:30:00.000Z",
    "status": "已批准",
    "approver": "李四",
    "reason": "家庭旅游，提前申请年假。"
  },
  "message": "审批成功"
}
```

### 错误响应

| 场景 | HTTP 状态码 | code | message |
|------|-------------|------|---------|
| 记录不存在 | `404` | `404` | `记录不存在，id: {id}` |
| 记录状态非"待审批" | `403` | `403` | `仅"待审批"状态的记录可以审批，当前状态：已批准` |
| `status` 字段缺失 | `400` | `400` | `status 为必填项` |
| `status` 枚举值非法 | `400` | `400` | `status 非法，审批结果只能为：已批准 或 已拒绝` |
| `approver` 字段缺失或为空 | `400` | `400` | `approver（审批人）为必填项` |

```json
{
  "code": 403,
  "data": null,
  "message": "仅\"待审批\"状态的记录可以审批，当前状态：已批准"
}
```

```json
{
  "code": 400,
  "data": null,
  "message": "status 非法，审批结果只能为：已批准 或 已拒绝"
}
```

### 业务规则

- **状态限制**：仅 `status === '待审批'` 的记录可发起审批；已处于终态（`已批准`/`已拒绝`）的记录返回 403
- **终态不可逆**：`已批准` 和 `已拒绝` 均为终态，不可再次变更状态
- **审批人必填**：`approver` 不可为空字符串，须填写真实审批人姓名
- **目标状态限制**：`status` 只能传 `已批准` 或 `已拒绝`，传入 `待审批` 视为非法操作，返回 400
- **其他字段不变**：此接口仅更新 `status` 和 `approver` 两个字段，其余字段保持不变

---

## 9. 错误码速查表

| HTTP 状态码 | code | 含义 | 常见触发场景 |
|-------------|------|------|-------------|
| `200` | `200` | 请求成功 | GET、PUT、DELETE、PATCH 操作成功 |
| `201` | `201` | 创建成功 | POST 新建记录成功 |
| `400` | `400` | 请求参数错误 | 必填字段缺失、枚举值非法、日期格式错误、字符超长 |
| `403` | `403` | 业务规则禁止 | 对非"待审批"记录执行编辑/删除/审批操作 |
| `404` | `404` | 资源不存在 | 指定 `id` 的记录在内存中不存在 |
| `500` | `500` | 服务器内部错误 | 未预期的服务端异常 |

**500 错误响应示例：**

```json
{
  "code": 500,
  "data": null,
  "message": "服务器内部错误，请稍后重试"
}
```

---

## 10. 枚举值定义

### 10.1 leave_type（休假类型）

| 枚举值 | 说明 |
|--------|------|
| `年假` | 带薪年假 |
| `病假` | 因病请假 |
| `事假` | 个人事务假 |
| `婚假` | 结婚假期 |
| `产假` | 女性生育假期 |
| `陪产假` | 男性配偶陪产假期 |
| `丧假` | 直系亲属丧假 |

### 10.2 status（审批状态）

| 枚举值 | 说明 | 是否为终态 |
|--------|------|-----------|
| `待审批` | 初始状态，等待审批人处理 | ❌ |
| `已批准` | 审批通过 | ✅ |
| `已拒绝` | 审批拒绝 | ✅ |

### 10.3 状态流转规则汇总

| 操作 | 允许的当前状态 | 说明 |
|------|---------------|------|
| 编辑（PUT） | `待审批` | 已批准/已拒绝不可编辑 |
| 删除（DELETE） | `待审批` | 已批准/已拒绝不可删除 |
| 审批（PATCH /status） | `待审批` | 已批准/已拒绝不可再次审批 |
| 查询（GET） | 任意状态 | 无状态限制 |

---

*文档结束 — design/api_spec.md*
