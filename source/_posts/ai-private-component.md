---
title: AIGC 实战：基于私有组件库生成业务组件
date: 2025-02-27 09:48:37
tags:
- ai
categories:
- ai
---

# 前言

随着大模型能力不断增强，AI 辅助编码已经成为一个非常热门的话题。很多公司都会维护自己的私有组件库，基于私有组件库生成业务组件成为了一个非常有意义的事情，本文记录下最近学习探索的过程。

项目的最终目的是实现如下图所示的聊天机器：



本文主要通过 RAG（Retrival Augmented Generation）来解决大模型缺少私域知识的问题，主要的步骤如下：

1 准备私有组件数据
2 私有组件 Embedding
3 Biz Component Codegen 后端接口实现
4 Biz Component Codegen 前端页面实现


# 准备私有组件数据
从头写一个私有组件库工作量太大了，所以这里我直接 clone 知名组件库 antd 来做实验，考虑到源码量太多，所以本文打算只提取组件的使用说明文档来作为知识库。

可以让 AI 帮我写一段脚本，提示词如下：

```
请帮我写一个脚本，将 basic-components/ayou-design/components 中所有组件的使用说明文档提取出来，生成 components-doc.txt 文件放到 ai-docs 下面，并将 antd 的关键字用 ayoud 替换，每个组件的文档用 "--------split--------" 分隔
```

其中 `ayou-design` 就是克隆下来的 `ant-design`，只是换了一个名字。
