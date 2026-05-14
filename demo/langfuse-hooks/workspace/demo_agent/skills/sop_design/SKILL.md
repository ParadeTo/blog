---
name: sop_design
description: 技术设计文档 SOP——从需求到设计方案，产出 Markdown 文件到 workspace/demo_agent/output/
type: task
---

# 技术设计文档 SOP

收到功能需求后，按以下 4 步产出设计文档，并将结果写入文件：

## Step 1: 需求摘要

用 2-3 句话概括需求的核心目标和边界。

## Step 2: 方案概述

- 技术选型（语言/框架/中间件）
- 核心模块划分（列出 2-3 个模块，每个一句话）
- 数据流简述

## Step 3: 接口设计

列出 1-2 个关键 API 接口：

- 路径、方法、入参、出参
- 用简洁的伪 JSON 表示

## Step 4: 风险与待确认项

列出 1-2 个技术风险或需要和产品确认的问题。

输出要求：

- 格式：Markdown
- 文件：`workspace/demo_agent/output/design_doc.md`
- 返回 JSON：`{"errcode": 0, "errmsg": "success", "file_path": "workspace/demo_agent/output/design_doc.md"}`
