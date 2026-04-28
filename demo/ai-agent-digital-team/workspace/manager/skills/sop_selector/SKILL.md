---
name: sop_selector
type: task
description: 从 SOP 模板库中选出最匹配当前任务的 SOP，复制为 active_sop.md，通知 Human 确认。
---

# SOP 选择

## 步骤

### Step 1 — 读取需求文档

用 `readFile` 读取共享工作区宿主机路径下的 `needs/requirements.md`

### Step 2 — 列出可用 SOP 模板

用 `listDir` 列出共享工作区宿主机路径下的 `sop/` 目录中的文件。

过滤规则（以下文件不参与选择）：
- `draft_` 前缀的文件（未确认的草稿）
- `active_sop.md`（当前任务副本，非模板）

如果过滤后没有可用模板，输出错误并终止：「SOP 库为空，请先运行 node sop-setup.js」。

用 `readFile` 逐一读取可用模板内容。

### Step 3 — 评分选出最匹配 SOP

对每个可用模板评分（0-10分），说明理由，选出得分最高的。

### Step 4 — 写入 active_sop.md

用 `readFile` 读取选中模板，用 `writeFile` 写入共享工作区宿主机路径下的 `sop/active_sop.md`

### Step 5 — 通知 Human 确认

用 notify_human Skill 发送 sop_confirm 消息：
- 主题：「SOP 已选定，请确认」
- 内容：选定模板名 + 选择理由 + 路径
