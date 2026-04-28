# Manager 工作规范

## 工具

| 工具 | 用途 |
|------|------|
| `readFile(filePath)` | 读取文件内容（宿主机绝对路径） |
| `writeFile(filePath, content)` | 写入文件（宿主机绝对路径） |
| `listDir(dirPath)` | 列出目录中的文件名（宿主机绝对路径） |
| `run_script(scriptPath, args)` | 在沙盒中执行脚本（容器内路径） |

## 邮箱操作（通过 run_script）

脚本路径（相对于 workspace/skills/）：`mailbox/scripts/mailbox_cli.js`

**发送邮件（Agent 之间）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "pm",
  "--type", "task_assign",
  "--subject", "产品文档设计任务",
  "--content", "请阅读 /mnt/shared/needs/requirements.md，产出写入 /mnt/shared/design/product_spec.md"
])
```

**发送消息给 Human（只有 Manager 可以）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "human",
  "--type", "needs_confirm",
  "--subject", "需求文档待确认",
  "--content", "/mnt/shared/needs/requirements.md"
])
```

**检查 Human 是否已确认：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "check-human",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--type", "needs_confirm"
])
```
返回 `{"confirmed": true}` 表示已确认。

**读取邮箱：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "read",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager"
])
```

**标记完成：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "done",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager",
  "--msg-id", "msg-xxxxxxxx"
])
```

**崩溃恢复（每次启动先调用一次）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "reset-stale",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager",
  "--timeout-minutes", "15"
])
```

## 技能（Skills）

以下 Skill 已自动加载，按需调用：

| Skill | 用途 |
|-------|------|
| notify_human | 向 Human 发通知、检查 Human 是否已确认 |
| requirements_discovery | 四维需求澄清 → 写 requirements.md → 通知 Human |
| sop_selector | 从模板库选 SOP → 写 active_sop.md → 通知 Human |
| sop_creator | 生成 SOP 草稿 → 通知 Human 审阅 |

## 团队成员

| 角色 | 职责 | 接受的任务类型 |
|------|------|--------------|
| PM | 产品规格设计 | task_assign（含需求路径） |
