---
title: 使用 AI 改造老项目
date: 2026-06-01 17:21:16
tags:
  - ai
categories:
  - ai
description: 介绍使用 AI 来改造老项目
---


# 使用 AI 来了解项目

## 生成架构图、模块图、依赖图等

```
你现在要理解一个有前后端的开源项目：

项目路径：/****/idurar-erp-crm

目标：
先把这个项目的整体结构摸清楚，生成一组项目全景图，作为后续分析接口、数据模型、业务流程和项目规范的基础。

请注意：
- 必须基于真实代码、README、配置文件、路由、接口、模型、前端页面和状态逻辑分析。
- 不要根据目录名或项目名脑补。
- 先读代码，再生成图。
- 不要修改业务代码，只在 docs/ 目录生成图。
- 如果某类信息没找到，明确写“未发现”，不要硬编。

请先扫描：
- README.md
- INSTALLATION-INSTRUCTIONS.md
- package.json / backend package 配置 / frontend package 配置
- backend 目录
- frontend 目录
- doc 目录
- .github / Docker / env 示例等配置

然后生成以下图到 docs/：

1. docs/system-architecture.svg
   全栈系统架构图。画出浏览器、前端应用、后端 API、数据库、认证、文件/邮件/第三方服务、部署环境之间的关系。

2. docs/frontend-architecture.svg
   前端架构图。画出入口、路由、页面、核心业务模块、组件层、状态层、API service、工具层、静态资源。

3. docs/backend-architecture.svg
   后端架构图。画出入口、路由层、controller、service、model/schema、middleware、config、数据库和外部集成。

4. docs/module-deps.svg
   模块依赖图。分别梳理 frontend 和 backend 的核心模块依赖，只画主干，不画所有小文件。

5. docs/external-deps.svg
   外部依赖图。画出数据库、邮件、认证、存储、第三方 SDK、运行环境变量、部署平台等依赖。

6. docs/core-business-flow.svg
   选择一个最核心业务流程，例如“创建 Invoice / Customer / Quote”，画出从前端页面到后端 API，再到数据库模型的完整链路。

要求：
- 每张图只画主干。
- 每个核心节点写一句职责。
- 图里不要塞太多文字，详细说明后续放到 Markdown 文档里。
- 每条边都要能在代码、配置或 README 中找到依据。
- 生成后做一次自检：有没有脑补、有没有遗漏明显模块、有没有把前端画成后端服务。
- 所有图自上而下的绘制
```


## 生成接口清单、Schema、数据流等

```
你现在要为一个有前后端的开源项目生成项目理解文档：

项目路径：/Users/youxingzhi/ayou/idurar-erp-crm

目标：
基于真实代码生成接口、前端交互、状态、数据模型和业务领域文档，帮助后续改代码前快速理解项目。

请注意：
- 必须基于真实代码，不要脑补。
- 不要修改业务代码，只在 docs/ 目录生成 Markdown 文档。
- 不要只列文件名，要写职责、数据流和调用关系。
- 如果某类能力没有发现，明确写“未发现”。

请扫描：
- backend 路由、controller、service、model/schema、middleware、config
- frontend 路由、页面、组件、状态管理、hooks、API service、utils
- package.json、环境变量示例、README、安装文档
- doc 目录中已有文档

生成以下文档到 docs/：

1. docs/api-list.md
   后端 API 清单。
   按业务模块分组列出：HTTP 方法、路径、说明、入参、返回结构、权限/认证要求、对应 controller/service/model。

2. docs/backend-data-model.md
   后端数据模型。
   扫描数据库 schema/model/entity。
   列出核心模型字段、类型、含义、关系、约束、索引、创建/更新位置。

3. docs/routes-pages.md
   前端路由与页面清单。
   列出每个路由、页面组件、动态参数、layout、权限规则、页面职责。

4. docs/ui-actions.md
   前端用户操作清单。
   按页面或业务模块分组，列出用户能触发的核心操作。
   每个操作写清楚：入口页面/组件、触发事件、调用方法、影响的状态、是否请求 API、是否写入本地存储。

5. docs/frontend-state-model.md
   前端状态模型。
   梳理组件状态、全局 store/context、hooks、cache、URL 状态、本地存储。
   每个状态模块写清楚：负责的数据、主要读者、主要写者、更新入口、是否持久化。

6. docs/domain-model.md
   业务领域模型。
   把前后端共同的核心概念整理出来，例如 Customer、Invoice、Quote、Payment、Product、User 等。
   每个模型写清楚：业务含义、前端展示位置、后端 API、后端数据模型、关键字段、关联关系。

7. docs/data-flow.md
   前后端数据流说明。
   选择 1-3 个核心流程，说明：
   用户操作 -> 前端状态变化 -> API 请求 -> 后端 controller/service -> 数据库模型 -> API 响应 -> 前端 UI 更新。

8. docs/external-integrations.md
   外部集成清单。
   梳理邮件、认证、上传、第三方服务、浏览器 API、部署平台等。
   每项写清楚：调用位置、输入输出、失败处理、环境变量依赖。

最后做一次交叉校对：
- api-list.md 里的模型，必须能在 backend-data-model.md 或 domain-model.md 找到。
- ui-actions.md 里的 API，必须能在 api-list.md 找到。
- routes-pages.md 里的页面，必须能和 ui-actions.md 里的操作对应。
- domain-model.md 里的核心模型，必须能在前端页面或后端模型中找到使用位置。
```


## 生成 CLAUDE.md

```
读 docs/ 下的所有资产，给我生成一份 CLAUDE.md 初稿。
精简：项目定位、核心架构、关键模块、关键约定、怎么跑，
外加两节空着的：禁区、历史包袱。
架构图、接口清单、数据模型的详细内容不要复制进来，
用链接指向 docs/ 就好。保存到项目根目录的 CLAUDE.md。
```

## 文档同步 skill

```
/superpowers:writing-skills 当项目代码有变化时,同步更新相关文档
```



# 使用 AI 来运行及测试项目

## 项目启动

```
给我列一份这个项目运行需要的完整外部依赖清单。
每个依赖列出：名字、版本要求（精确到主版本）、默认端口、
连接信息、初始化要求。
保存到 docs/env-checklist.md。
```


```
读 docs/env-checklist.md，给我生成一份本地安装脚本，保存到 scripts/install-deps.sh。
- 使用 podman 装中间件（需要先运行 podman）
- 包含每个中间件的初始化（建库 SQL 等）

生成完直接执行这个脚本。执行过程遵循自主修复原则:
- 任何一步失败，先看报错信息
- 自己判断原因（版本不对、源问题、权限问题、依赖缺失）
- 自己修（换源、换版本、加 sudo、装前置依赖）
- 修完重试，跑通为止
- 不要每个错误都问我

如果同一个错误连续修 3 次还不行，停下来汇报具体卡在哪。
其他情况一律自己解决。

最终输出一份 scripts/install-log.md，记录每个中间件
最终用了什么命令装上、过程中遇到什么问题、怎么修的。
```

```
基于装好的中间件，生成三个脚本到 scripts/ 下：
- deps-start.sh：一键启动所有依赖中间件
- deps-stop.sh：一键停止所有依赖中间件
- deps-status.sh：查看每个中间件的运行状态

启动后等服务就绪再返回，不要"启动了但还没 ready"。
status 脚本要打印每个中间件的运行状态和端口监听情况。
```


启动：

```
先帮我启动中间件
然后帮我启动应用
启动过程同样遵循自主修复原则

启动成功后告诉我各服务的地址。
失败和修复的过程记到 docs/startup-log.md
```

冒烟测试：
```
给我做一下基本的冒烟测试，不要修改代码，最后输出一份 docs/smoke-test-result.md。
```

guide：

```
基于 scripts/install-log.md 和 docs/startup-log.md，
整理一份给新人看的 setup-guide.md，
包含：前置条件、装中间件步骤、启动命令、常见踩坑、验证清单。
保存到 docs/setup-guide.md。
```