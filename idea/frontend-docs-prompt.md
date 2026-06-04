# 前端第九课：契约文档 + 数据模型提示词

这份提示词用于为纯前端项目生成第九课风格的项目理解资产。

后端第九课产出的是“接口清单 + 数据模型”；前端对应产出“路由页面清单 + 用户操作清单 + 状态模型 + 领域模型”。

```text
你现在要为一个纯前端项目生成第九课风格的“前端契约文档”和“前端数据模型文档”。

项目路径：<PROJECT_PATH>

请基于真实代码扫描：
- package.json 和构建配置
- src/main、src/index、src/App、router 配置
- pages/views/routes
- components/features/modules
- hooks/composables
- context/store/state
- services/api/request
- data/mock/constants
- utils
- 本地存储、缓存、IndexedDB、localStorage/sessionStorage 相关代码

生成以下文档到 docs/：

1. docs/frontend-project-map.md
   前端项目总览。包括项目定位、技术栈、入口文件、目录结构、核心模块、数据来源、构建运行方式。

2. docs/routes-pages.md
   路由与页面清单。列出每个路由、对应页面组件、动态参数、嵌套路由、layout、redirect、404、权限规则。

3. docs/ui-actions.md
   用户操作清单。按页面或业务模块分组，列出用户能触发的核心操作。
   每个操作写清楚：入口页面/组件、触发事件、调用方法、影响的状态、是否请求 API、是否写入本地存储。

4. docs/state-model.md
   状态模型说明。梳理组件本地状态、全局 store/context、hooks/composables、缓存状态、URL 状态。
   每个状态模块写清楚：负责的数据、主要读者、主要写者、更新入口、是否持久化。

5. docs/domain-model.md
   前端领域模型。梳理业务里最核心的数据对象。
   每个模型写清楚：字段、类型、含义、关系、约束、在哪里被创建、在哪里被修改、在哪里被展示。

6. docs/data-sources.md
   数据来源说明。梳理 API、mock、静态 JSON、配置文件、URL 参数、浏览器存储等数据来源。
   每项写清楚：读取位置、数据结构、使用方、错误或空数据处理。

7. docs/persistence-model.md
   本地存储/缓存模型。梳理 localStorage、sessionStorage、IndexedDB、Cache、内存缓存等。
   写清楚：key/table、字段结构、保存时机、加载时机、清理时机、兼容逻辑。

8. docs/external-integrations.md
   外部集成清单。梳理后端 API、第三方 SDK、埋点、登录认证、支付、地图、编辑器、浏览器 API 等。
   每项写清楚：调用位置、输入输出、失败处理、环境变量依赖。

9. docs/import-export-contracts.md
   如果项目存在导入导出能力，再生成这份文档。
   写清楚：输入格式 -> parser -> 内部 model -> exporter -> 输出格式。
   如果没有导入导出能力，明确写“未发现”，不要强行生成。

要求：
- 必须基于真实代码，不要根据目录名脑补。
- 不要只列文件名，要写职责、数据流和调用关系。
- 如果某类能力未发现，明确标注“未发现”。
- 文档保持可维护，不要把源码逐行复述进去。
- 最后做一次交叉校对：
  - ui-actions.md 里的状态必须能在 state-model.md 找到。
  - domain-model.md 里的核心模型必须能在页面、状态、API 或本地存储中找到使用位置。
  - routes-pages.md 里的页面必须能和 ui-actions.md 里的操作对应起来。
```

一句话版本：

```text
后端第九课：接口清单 + 数据模型。
前端第九课：路由页面清单 + 用户操作清单 + 状态模型 + 领域模型。
```
