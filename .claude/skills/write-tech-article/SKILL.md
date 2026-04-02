---
name: write-tech-article
description: Use when the user wants to write a new technical blog article or edit/revise an existing one. Triggers on requests like "write an article about X", "write a blog post on X", "help me revise this article", "polish this blog post", or when given a GitHub URL and asked to write about it.
---

# 写技术文章

## 概述

以用户固有的个人风格撰写技术博客文章，内容涵盖 GitHub 项目、技术话题或本地代码项目。输出为 Hexo 格式的 Markdown 文件，保存至 `~/ayou/blog/source/_posts/`。

**正式动笔前，必须先确认大纲。**

## 工作流程

**新文章：**
```
1. 分析输入
2. 提炼亮点
3. 生成大纲 → 等待用户确认
4. 撰写全文
5. 保存到博客
```

**修改已有文章：**
```
1. 读取现有文章文件
2. 理解用户的修改意图
3. 直接修改（无需确认大纲）
4. 保存更新后的文件
```

### 第一步：分析输入

判断输入类型并收集信息：

- **GitHub URL** — 使用 `gh repo view <owner/repo>` 或 WebFetch 读取 README、仓库结构、关键源文件、Star 数及使用示例
- **技术话题** — 使用 WebSearch 收集核心概念、使用场景和实际案例
- **本地目录** — 使用当前工作目录；读取 README、package.json/Cargo.toml 及关键源文件

### 第二步：提炼亮点

识别：
- 该项目/技术解决的核心问题
- 2–3 个最有意思的切入角度（架构、用法、演示、源码剖析）
- 文章类型：**工具介绍型** / **源码解析型** / **实战教程型**

### 第三步：生成大纲（等待用户确认）

向用户展示：
- 建议标题
- 每个章节标题 + 一句话描述
- 建议的标签/分类

**在用户确认或修改大纲之前，不得撰写全文。**

### 第四步：撰写全文

遵循下方所有写作规范。需要截图的地方使用图片占位符，如 `![](./slug/1.png)`。

### 第五步：保存到博客

- 选择简短的英文/拼音 slug（如 `ai-langgraph.md`、`react-suspense.md`）
- 将完整文件写入 `~/ayou/blog/source/_posts/<slug>.md`
- 告知用户文件路径

---

## 写作风格

### 结构

| 文章长度 | 章节风格 |
|---|---|
| 长篇（5 节以上） | `# 一、标题`、`# 二、标题`；小节用 `## 1.1` |
| 短篇（2–4 节） | 普通标题：`# 实现方式`、`# 总结` |

始终以 `# 前言` 开头——交代背景、描述痛点、说明为什么值得关注。

### 语气

- 口语化、有代入感："浅玩一下"、"接下来我们体验一下"、"简直赢麻了"
- 先抛出问题或疑问，再揭晓答案——不要一上来就说结论
- 用 `**加粗**` 标注关键术语和结构性重点

### 内容规范

- 有演示效果或结果图时：在对应章节开头写"先上效果" + 图片占位符
- GitHub 项目：始终链接到具体的 tag 或 commit，如 `[v1](https://github.com/owner/repo/tree/v1)`
- 代码块：始终加语言标识符（` ```typescript `、` ```bash `、` ```python `）
- 图片：本地相对路径 `./article-slug/N.png`，仅使用 PNG 或 JPG 格式（不用 SVG、WebP 等）；需要示意图或流程图时，由 Claude 直接绘制并保存为图片文件，不要使用 bash 命令生成图片，也不要留占位符
- SVG 转 PNG/JPG：使用 `node ~/.claude/skills/write-tech-article/svg-to-image.js <file.svg> [png|jpg] [width]`；依赖 `sharp`（优先）或 `playwright`，首次使用需安装（`npm install sharp`）
- 先说"为什么"，再说"怎么做"——不要只堆代码，先给出背景
- 段落和章节之间要有自然的衔接过渡，每个章节应顺势引出下一节，避免生硬跳转

### Frontmatter 模板

```yaml
---
title: 文章标题
date: YYYY-MM-DD HH:MM:SS
tags:
  - tag1
  - tag2
categories:
  - 分类
description: 一句话描述，用于 SEO 和文章摘要
---
```

**现有文章的常见标签/分类规律：**
- AI 工具类：标签 `ai`、`agent`；分类 `ai`
- 源码系列：标签对应技术栈（如 `wasm`、`react`）；分类为语言（如 `rust`）
- 算法类：标签 `algorithm`；分类 `algorithm`
- 前端类：标签对应框架；分类 `frontend`

---

## Demo 运行

当文章需要运行 demo 来验证效果或截图时：

- 将 demo 项目放在 `./demo` 目录下
- 前端项目统一使用 **pnpm** 作为包管理器（安装依赖用 `pnpm install`，启动用 `pnpm dev` 等）

---

## 常见错误

| 错误 | 修正 |
|---|---|
| 未确认大纲就开始写全文 | 始终展示大纲并等待确认 |
| 前言空泛，没有明确的痛点 | 用具体场景或问题开头 |
| 代码块没有语言标识符 | 三个反引号后必须加语言 |
| Frontmatter 缺少 `description` 字段 | 必填——写一句简洁的摘要 |
| 文件名使用中文 | 只能使用英文/拼音 slug |
