# 前端第十课：从前端资产生成 CLAUDE.md 提示词

这份提示词用于把前端项目里已经生成的图和文档，提炼成一份项目根目录的 `CLAUDE.md`。

后端第十课强调：`CLAUDE.md` 是“索引 + 常识”，不是把 docs/ 复制一遍。

前端也是一样：不要把所有路由、组件、状态字段都塞进 `CLAUDE.md`，而是让 AI 启动时先知道这个前端项目是什么、核心边界在哪里、改代码前该看哪些文档、哪些地方不能随便动。

```text
你现在要基于一个纯前端项目已有的 docs/ 资产，生成项目根目录的 CLAUDE.md。

项目路径：<PROJECT_PATH>

请先读取 docs/ 下已有的前端项目理解资产，包括但不限于：
- docs/frontend-project-map.md
- docs/routes-pages.md
- docs/ui-actions.md
- docs/state-model.md
- docs/domain-model.md
- docs/data-sources.md
- docs/persistence-model.md
- docs/external-integrations.md
- docs/import-export-contracts.md
- docs/frontend-architecture.svg
- docs/routes-pages.svg
- docs/component-module-deps.svg
- docs/state-data-flow.svg
- docs/core-user-flows.svg
- docs/build-runtime.svg

然后生成一份 CLAUDE.md，保存到项目根目录。

定位：
- CLAUDE.md 是“索引 + 项目常识”，不是详细文档。
- 控制在 300 行以内。
- 不要复制完整路由清单、组件清单、状态字段、领域模型字段。
- 详细内容统一用链接指向 docs/。

请包含以下章节：

1. 项目定位
   用 1-3 句话说清楚这个前端项目是什么，解决什么问题，主要用户是谁。

2. 技术栈
   简短列出框架、构建工具、路由、状态管理、UI 库、请求库、存储方案、测试工具。
   不要写通用介绍，只写本项目实际使用的技术。

3. 启动和构建
   写清楚常用命令，例如 install、dev、build、lint、test、preview。
   如果 docs/build-runtime.svg 或 frontend-project-map.md 已经写了细节，这里只保留命令和链接。

4. 入口和路由
   写清楚入口文件、路由定义位置、主要页面入口。
   详细路由指向 docs/routes-pages.md。

5. 核心模块边界
   用一个小表说明主要页面、业务模块、通用组件、hooks/store/context、services/api、utils/data 的职责边界。
   详细依赖关系指向 docs/component-module-deps.svg。

6. 状态和数据流
   写清楚本项目的状态组织方式：组件状态、全局状态、URL 状态、缓存、本地存储、API 数据。
   详细内容指向 docs/state-model.md 和 docs/state-data-flow.svg。

7. 领域模型
   用几句话说明项目里最核心的数据对象是什么。
   详细字段、关系、约束指向 docs/domain-model.md。

8. 用户操作契约
   写清楚改功能时应该先查 docs/ui-actions.md。
   说明用户操作、状态变化、API/存储写入之间必须保持一致。

9. 数据来源和外部集成
   简短说明后端 API、mock、静态数据、本地存储、第三方 SDK、浏览器 API 等数据来源。
   详细内容指向 docs/data-sources.md、docs/persistence-model.md、docs/external-integrations.md。

10. 导入导出契约（如果项目存在）
    如果项目有导入导出能力，说明输入格式、内部模型、输出格式的总链路。
    详细内容指向 docs/import-export-contracts.md。
    如果没有，写“本项目未发现导入导出能力”。

11. 改代码前的检查清单
    写成简短 checklist：
    - 改页面前先看 routes-pages.md
    - 改交互前先看 ui-actions.md
    - 改状态前先看 state-model.md
    - 改核心数据结构前先看 domain-model.md
    - 改存储/API/导入导出前先看对应文档
    - 改完后同步相关 docs/ 资产

12. 禁区
    这一节留给人手写。
    只放标题和占位说明，不要猜。
    示例说明：哪些组件、状态字段、存储 key、API 参数、兼容逻辑、历史路由不能随便改。

13. 历史包袱
    这一节留给人手写。
    只放标题和占位说明，不要猜。
    示例说明：哪些看起来奇怪但有历史原因的组件、状态设计、兼容逻辑、样式方案、第三方库不能随手重构。

14. 文档索引
    列出 docs/ 下关键图和文档的链接。

要求：
- 必须基于真实 docs/ 和源码，不要脑补。
- 禁区和历史包袱必须留空或标注“待人工补充”，不要替人编。
- 不要写通用前端规范，例如“组件要复用”“代码要有注释”。
- 只写本项目特有的常识和索引。
- 如果 CLAUDE.md 超过 300 行，压缩内容，把细节下放到 docs/。
- 生成后自检：
  - 有没有复制大段 docs/ 内容？
  - 有没有写通用废话？
  - 有没有把禁区和历史包袱写成 AI 猜测？
  - 每个 docs/ 链接是否真实存在？
```

一句话版本：

```text
后端第十课：把架构图、接口清单、数据模型提炼成 CLAUDE.md。
前端第十课：把路由、组件、状态、用户操作、领域模型这些资产提炼成 CLAUDE.md。
```

前端 `CLAUDE.md` 最重要的不是“框架是什么”，而是：

```text
改页面看哪份文档；
改交互看哪份文档；
改状态看哪份文档；
改数据结构看哪份文档；
哪些历史逻辑不能随手重构。
```
