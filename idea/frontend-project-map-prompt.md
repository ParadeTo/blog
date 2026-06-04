# 纯前端项目理解：1 份项目地图 + 6 张图提示词

这份提示词用于理解一个纯前端项目，并生成后续写文章或沉淀 `CLAUDE.md` 可用的项目理解资产。

你现在要理解一个纯前端项目：<PROJECT_PATH>。

请先扫描项目根目录和 src 目录，基于真实代码识别：
- 技术栈：框架、构建工具、路由、状态管理、UI 库、请求库、测试工具
- 应用入口：main/index/App/router 等
- 页面结构：pages/views/routes
- 组件结构：components/features/modules
- 状态来源：组件状态、Context/store、hooks/composables、cache、本地存储
- 数据来源：API、mock、本地 JSON、IndexedDB/localStorage/sessionStorage
- 构建部署：package.json、vite/webpack/next/nuxt 配置、Docker、CI、env

然后在 docs/ 目录下生成一份前端项目理解资产，包括 Markdown 总结和以下图：

1. docs/frontend-architecture.svg
   前端应用架构图：浏览器入口、路由层、页面层、核心业务模块、通用组件、状态层、API/services、utils/data、浏览器存储、外部服务。

2. docs/routes-pages.svg
   路由与页面地图：所有路由、动态路由、嵌套路由、layout、redirect、404、权限路由，以及它们对应的页面组件。

3. docs/component-module-deps.svg
   组件/模块依赖图：页面层、业务组件层、通用组件层、hooks/store/context 层、services/api 层、utils/data 层之间的依赖关系。

4. docs/state-data-flow.svg
   状态与数据流图：用户操作如何触发事件、更新状态、请求 API、读写本地存储，并最终驱动 UI 重新渲染。

5. docs/core-user-flows.svg
   核心用户流程时序图：根据代码自动选择 1-3 个最核心用户流程，例如登录、搜索、编辑、保存、上传、导入、导出、拖拽编辑等，画出 User -> Page -> Component -> State/Store -> API/Storage 的链路。

6. docs/build-runtime.svg
   构建与运行图：dev/build/preview/start 命令、构建工具、环境变量、静态资源处理、部署目标、运行时依赖。

同时生成：
- docs/frontend-project-map.md

这个 Markdown 里要包含：
- 项目一句话定位
- 技术栈表格
- 入口文件说明
- 路由清单
- 核心模块清单
- 状态来源说明
- 数据来源说明
- 本地存储/API/第三方服务说明
- 构建部署说明
- 上面 6 张图的索引链接
- 你发现的潜在风险：循环依赖、状态重复、跨层依赖、未封装 API、过大的组件、构建配置隐患等

要求：
- 必须基于真实代码，不要根据目录名脑补。
- 每张图只画主干，不要把所有小组件都塞进去。
- 图里每个核心节点写一句职责。
- 如果某类能力项目里不存在，比如没有 API、没有 IndexedDB、没有测试，就明确标注“未发现”，不要强行画。
- 生成完后做一次自检：每张图是否能在代码里找到对应依据，是否存在不确定或猜测内容。

