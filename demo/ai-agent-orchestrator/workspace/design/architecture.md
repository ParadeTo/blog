# 员工休假记录管理系统 — 架构设计文档

> 版本：1.0.0 | 日期：2025-07-01 | 作者：架构设计师

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈说明](#2-技术栈说明)
3. [完整目录结构](#3-完整目录结构)
4. [模块划分](#4-模块划分)
5. [数据模型定义](#5-数据模型定义)
6. [前后端交互流程](#6-前后端交互流程)

---

## 1. 项目概述

### 1.1 背景

员工休假记录管理系统用于企业内部对员工休假申请进行全生命周期管理，涵盖休假申请的**新建、查询、编辑、删除与审批**五大核心功能，适用于本地局域网或单机开发环境部署。

### 1.2 核心功能

| 功能模块 | 描述 |
|----------|------|
| 列表展示 | 展示所有休假记录，支持按员工姓名、休假类型、状态多条件筛选 |
| 新建申请 | 填写表单提交休假申请，系统自动计算天数与申请时间 |
| 编辑申请 | 修改"待审批"状态的休假记录（已批准/已拒绝不可编辑） |
| 删除申请 | 仅允许删除"待审批"状态记录，删除前需二次确认 |
| 审批管理 | 将"待审批"记录变更为"已批准"或"已拒绝"，并记录审批人 |

### 1.3 设计原则

- **轻量优先**：无数据库依赖，数据存储于内存，适合快速原型与本地开发
- **前后端分离**：前端纯静态页面通过 REST API 与后端通信
- **业务规则内聚**：状态流转、字段校验等业务规则统一在后端 Service 层实现
- **可读性优先**：代码结构清晰，每个文件职责单一，便于维护与扩展

---

## 2. 技术栈说明

### 2.1 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| HTML5 | — | 页面结构，语义化标签 |
| 原生 JavaScript (ES6+) | — | 不引入任何前端框架，使用 `fetch` API 完成异步请求 |
| CSS3 | — | 页面样式，Flexbox/Grid 布局 |

**选型理由**：无需构建工具，零依赖，浏览器直接打开即可运行，降低环境搭建成本。

### 2.2 后端

| 技术 | 版本建议 | 说明 |
|------|----------|------|
| Node.js | ≥ 18.x | JavaScript 运行时 |
| Express | ^4.x | 轻量 Web 框架，提供路由与中间件能力 |
| uuid | ^9.x | 生成符合 RFC 4122 的 UUID，作为记录唯一标识 |
| cors | ^2.x | 处理跨域请求（前端直接用文件协议打开时需要） |

**选型理由**：Express 生态成熟、API 简洁，适合快速搭建 RESTful 服务；无 ORM 依赖，数据操作直接操作内存 Map。

### 2.3 数据存储

| 方案 | 说明 |
|------|------|
| 内存 `Map<string, LeaveRecord>` | 以记录 `id`（UUID）为 key，记录对象为 value，进程重启后数据清空 |

**选型理由**：本地开发场景无需持久化，Map 提供 O(1) 的增删改查，结构简单直观。

---

## 3. 完整目录结构

```
leave-management/                  # 项目根目录
│
├── package.json                   # 项目元信息、依赖声明、启动脚本
├── package-lock.json              # 依赖版本锁定文件（npm 自动生成）
├── .gitignore                     # Git 忽略规则（node_modules 等）
├── README.md                      # 项目快速启动说明
│
├── design/                        # 设计文档目录
│   ├── architecture.md            # 架构设计文档（本文件）
│   └── api_spec.md                # API 接口规范文档
│
├── server/                        # 后端源码目录
│   ├── app.js                     # Express 应用入口：注册中间件、挂载路由、启动监听
│   │
│   ├── routes/                    # 路由层：仅负责 URL 映射，不含业务逻辑
│   │   └── leaves.js              # /api/leaves 相关路由定义
│   │
│   ├── controllers/               # 控制器层：解析请求参数、调用 Service、返回响应
│   │   └── leavesController.js    # 休假记录的 CRUD 与审批控制器方法
│   │
│   ├── services/                  # 服务层：核心业务逻辑（校验、状态流转、计算）
│   │   └── leavesService.js       # 休假记录业务规则实现
│   │
│   ├── store/                     # 数据存储层：封装内存 Map 的读写操作
│   │   └── leavesStore.js         # Map 实例及 CRUD 操作方法
│   │
│   └── utils/                     # 工具函数
│       └── validators.js          # 字段校验函数（日期格式、枚举值、字符长度等）
│
└── public/                        # 前端静态资源目录（由 Express 托管）
    ├── index.html                 # 列表页：展示所有记录，含筛选栏与操作按钮
    ├── form.html                  # 表单页：新建 / 编辑休假申请
    │
    ├── css/
    │   └── style.css              # 全局样式：布局、表格、表单、按钮、弹窗
    │
    └── js/
        ├── api.js                 # API 请求封装：统一 fetch 调用、错误处理
        ├── list.js                # 列表页逻辑：渲染表格、筛选、删除确认、审批操作
        ├── form.js                # 表单页逻辑：表单渲染、校验、天数自动计算、提交
        └── utils.js               # 前端工具函数：日期格式化、枚举映射、提示弹窗
```

### 3.1 关键文件职责速查

| 文件 | 层次 | 核心职责 |
|------|------|----------|
| `server/app.js` | 入口 | 初始化 Express，注册 `cors`、`json` 中间件，挂载 `/api/leaves` 路由，启动 HTTP 服务 |
| `server/routes/leaves.js` | 路由层 | 声明 6 条路由规则，将请求分发到对应 Controller 方法 |
| `server/controllers/leavesController.js` | 控制器层 | 提取 `req.params`、`req.query`、`req.body`，调用 Service，构造 `res.json()` 响应 |
| `server/services/leavesService.js` | 服务层 | 实现业务规则：状态校验、字段合法性、`days` 自动计算、`apply_time` 注入 |
| `server/store/leavesStore.js` | 存储层 | 封装 `Map` 的 `get/set/delete/values` 操作，提供统一数据访问接口 |
| `server/utils/validators.js` | 工具 | 纯函数：校验日期格式、枚举合法性、字符串长度，返回错误信息数组 |
| `public/js/api.js` | 前端 | 封装 `fetch`，统一处理 HTTP 错误，暴露 `getLeaves`、`createLeave` 等方法 |
| `public/js/list.js` | 前端 | 列表页主逻辑：拉取数据、渲染 DOM、绑定筛选/删除/审批事件 |
| `public/js/form.js` | 前端 | 表单页主逻辑：判断新建/编辑模式、实时计算天数、提交前校验 |

---

## 4. 模块划分

### 4.1 后端模块

```
┌─────────────────────────────────────────────────────┐
│                    HTTP 请求                         │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────▼────────┐
              │   路由层        │  leaves.js
              │  Route Layer   │  URL 映射 → Controller
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  控制器层       │  leavesController.js
              │ Controller     │  参数提取 → 调用 Service → 构造响应
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   服务层        │  leavesService.js
              │ Service Layer  │  业务规则 / 状态流转 / 字段计算
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   存储层        │  leavesStore.js
              │  Store Layer   │  内存 Map 读写
              └────────────────┘
```

#### 后端各模块职责详述

**路由层（Route）**
- 职责：声明 HTTP 方法 + 路径的映射关系
- 不包含任何业务逻辑
- 示例：`router.get('/', leavesController.list)`

**控制器层（Controller）**
- 职责：作为 HTTP 与业务逻辑的桥梁
- 从 `req` 中提取参数，传入 Service
- 将 Service 返回值序列化为 JSON 响应
- 捕获 Service 抛出的业务异常，转换为对应 HTTP 状态码

**服务层（Service）**
- 职责：实现所有业务规则，是系统的核心层
- 主要逻辑：
  - 新建时注入 `id`（UUID）、`apply_time`（当前时间）、`status`（待审批）
  - 自动计算 `days = end_date - start_date + 1`
  - 编辑/删除前校验 `status === '待审批'`
  - 审批时校验目标状态合法性，注入 `approver`

**存储层（Store）**
- 职责：封装内存 Map，提供统一数据访问接口
- 暴露方法：`findAll()`、`findById(id)`、`save(record)`、`update(id, data)`、`remove(id)`
- 隔离存储实现，未来可替换为数据库而不影响上层

### 4.2 前端模块

```
┌──────────────────────────────────────────────────────┐
│                    浏览器                             │
│                                                      │
│  ┌─────────────┐          ┌──────────────────────┐   │
│  │  index.html │          │      form.html        │   │
│  │  列表页      │          │   新建 / 编辑表单页    │   │
│  └──────┬──────┘          └──────────┬───────────┘   │
│         │                            │               │
│  ┌──────▼──────┐          ┌──────────▼───────────┐   │
│  │   list.js   │          │       form.js         │   │
│  │ 列表渲染     │          │  表单校验 / 天数计算   │   │
│  │ 筛选 / 操作  │          │  新建 / 编辑提交       │   │
│  └──────┬──────┘          └──────────┬───────────┘   │
│         │                            │               │
│         └──────────┬─────────────────┘               │
│                    │                                 │
│           ┌────────▼────────┐                        │
│           │     api.js      │                        │
│           │  fetch 封装      │                        │
│           │  统一错误处理    │                        │
│           └────────┬────────┘                        │
│                    │                                 │
│           ┌────────▼────────┐                        │
│           │    utils.js     │                        │
│           │ 日期格式化       │                        │
│           │ 枚举映射 / 提示  │                        │
│           └─────────────────┘                        │
└──────────────────────────────────────────────────────┘
```

#### 前端各模块职责详述

**api.js — 请求封装层**
- 统一 `baseURL = 'http://localhost:3000'`
- 封装 `GET/POST/PUT/DELETE/PATCH` 请求
- 统一处理非 2xx 响应，抛出含 `message` 的错误对象
- 暴露语义化方法：`getLeaves(filters)`、`getLeaveById(id)`、`createLeave(data)`、`updateLeave(id, data)`、`deleteLeave(id)`、`approveLeave(id, data)`

**list.js — 列表页逻辑**
- 页面加载时调用 `getLeaves()` 拉取全量数据并渲染表格
- 监听筛选表单变化，携带 query 参数重新请求
- 删除按钮：弹出 `confirm` 确认框，确认后调用 `deleteLeave(id)`
- 审批按钮：弹出审批弹窗，选择结果后调用 `approveLeave(id, data)`
- 编辑按钮：跳转至 `form.html?id={id}`

**form.js — 表单页逻辑**
- 通过 URL 参数 `id` 判断新建（无 id）或编辑（有 id）模式
- 编辑模式：调用 `getLeaveById(id)` 回填表单数据
- 监听 `start_date` / `end_date` 变化，实时计算并展示 `days`
- 提交前执行前端校验（必填项、日期合法性、字符长度）
- 提交成功后跳转回列表页

**utils.js — 工具函数**
- `formatDate(isoString)`：ISO 8601 → `YYYY-MM-DD HH:mm`
- `calcDays(startDate, endDate)`：计算自然日天数
- `leaveTypeLabel(type)`：枚举值 → 中文标签
- `statusBadge(status)`：状态 → 带样式的 HTML 徽章
- `showToast(message, type)`：轻量提示条（成功/错误）

---

## 5. 数据模型定义

### 5.1 LeaveRecord 完整字段表

| 字段名 | 类型 | 是否必填 | 约束 / 说明 |
|--------|------|----------|-------------|
| `id` | `string` | 系统生成 | UUID v4，全局唯一，创建时由后端生成，不可修改 |
| `employee_id` | `string` | ✅ 必填 | 员工工号，非空字符串 |
| `employee_name` | `string` | ✅ 必填 | 员工姓名，非空字符串 |
| `leave_type` | `enum` | ✅ 必填 | 枚举值：`年假`、`病假`、`事假`、`婚假`、`产假`、`陪产假`、`丧假` |
| `start_date` | `string` | ✅ 必填 | 格式 `YYYY-MM-DD`，须为合法日期 |
| `end_date` | `string` | ✅ 必填 | 格式 `YYYY-MM-DD`，须 `>= start_date` |
| `days` | `number` | 系统计算 | 整数，`end_date - start_date + 1`（自然日），由后端自动计算，前端只读展示 |
| `apply_time` | `string` | 系统生成 | ISO 8601 格式（如 `2025-07-01T09:00:00.000Z`），记录创建时由后端注入 |
| `status` | `enum` | 系统默认 | 枚举值：`待审批`、`已批准`、`已拒绝`；新建时默认 `待审批` |
| `approver` | `string` | 条件必填 | 审批人姓名；调用审批接口时必填，新建/编辑时可为空 |
| `reason` | `string` | ✅ 必填 | 申请理由，非空且不超过 200 个字符 |

### 5.2 状态流转图

```
                    ┌──────────┐
     新建申请 ──────▶│  待审批   │
                    └────┬─────┘
                         │  调用审批接口（PATCH /status）
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │  已批准   │          │  已拒绝   │
        └──────────┘          └──────────┘

  说明：
  - 仅"待审批"状态可被编辑（PUT）
  - 仅"待审批"状态可被删除（DELETE）
  - 仅"待审批"状态可发起审批（PATCH /status）
  - "已批准"/"已拒绝"为终态，不可逆转
```

### 5.3 数据示例

```json
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
}
```

### 5.4 内存存储结构

```javascript
// server/store/leavesStore.js
const store = new Map();
// store 结构示意：
// Map {
//   "a1b2c3d4-..." => { id, employee_id, employee_name, ... },
//   "b2c3d4e5-..." => { id, employee_id, employee_name, ... },
// }
```

---

## 6. 前后端交互流程

### 6.1 查询列表（含筛选）

```
用户操作筛选条件
      │
      ▼
list.js 收集筛选参数
      │  { employee_name, leave_type, status }
      ▼
api.js → GET /api/leaves?employee_name=张三&status=待审批
      │
      ▼
后端 Route → Controller → Service
      │  Service 从 Store 取全量数据，按参数过滤
      ▼
返回 200 + JSON 数组
      │
      ▼
list.js 渲染表格 DOM
```

### 6.2 新建休假申请

```
用户填写表单
      │
      ▼
form.js 前端校验（必填、日期、字符长度）
      │  校验失败 → 展示错误提示，阻止提交
      ▼
api.js → POST /api/leaves  Body: { employee_id, employee_name, ... }
      │
      ▼
后端 Service：
  1. 再次校验字段合法性
  2. 生成 id（UUID）、注入 apply_time、设置 status="待审批"
  3. 计算 days = end_date - start_date + 1
  4. 写入 Store（Map.set）
      │
      ▼
返回 201 + 完整记录 JSON
      │
      ▼
form.js 跳转至列表页
```

### 6.3 编辑休假申请

```
用户点击"编辑"按钮
      │
      ▼
跳转 form.html?id={id}
      │
      ▼
form.js 调用 GET /api/leaves/:id 回填表单
      │
      ▼
用户修改后提交
      │
      ▼
api.js → PUT /api/leaves/:id  Body: { 修改后字段 }
      │
      ▼
后端 Service：
  1. 校验记录存在
  2. 校验 status === "待审批"（否则返回 403）
  3. 重新计算 days
  4. 更新 Store
      │
      ▼
返回 200 + 更新后记录 JSON
      │
      ▼
form.js 跳转至列表页
```

### 6.4 删除休假申请

```
用户点击"删除"按钮
      │
      ▼
list.js 弹出 confirm 确认框
      │  用户取消 → 流程结束
      ▼  用户确认 ↓
api.js → DELETE /api/leaves/:id
      │
      ▼
后端 Service：
  1. 校验记录存在（否则 404）
  2. 校验 status === "待审批"（否则 403）
  3. 从 Store 删除（Map.delete）
      │
      ▼
返回 200 + { message: "删除成功" }
      │
      ▼
list.js 从表格中移除该行 / 重新拉取列表
```

### 6.5 审批休假申请

```
用户点击"审批"按钮
      │
      ▼
list.js 展示审批弹窗（选择"已批准"/"已拒绝"，填写审批人）
      │
      ▼
api.js → PATCH /api/leaves/:id/status
         Body: { status: "已批准", approver: "李四" }
      │
      ▼
后端 Service：
  1. 校验记录存在（否则 404）
  2. 校验当前 status === "待审批"（否则 403）
  3. 校验目标 status ∈ ["已批准", "已拒绝"]（否则 400）
  4. 校验 approver 非空（否则 400）
  5. 更新 status 与 approver，写入 Store
      │
      ▼
返回 200 + 更新后记录 JSON
      │
      ▼
list.js 刷新该行状态展示
```

---

*文档结束 — design/architecture.md*
