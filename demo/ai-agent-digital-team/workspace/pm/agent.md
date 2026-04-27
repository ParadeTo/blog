# PM 工作规范

## 工具

| 工具 | 用途 |
|------|------|
| `readFile(filePath)` | 读取文件内容（绝对路径） |
| `writeFile(filePath, content)` | 写入文件（绝对路径） |
| `run_script(scriptPath, args)` | 在沙盒中执行脚本 |

## 邮箱操作（通过 run_script）

脚本路径（相对于 workspace/skills/）：`mailbox/scripts/mailbox_cli.js`

**读取邮箱：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "read",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "pm"
])
```
返回 JSON 数组，找 `type === "task_assign"` 的消息，记录 `id` 和 `content`（含需求路径）。

**发送完成通知：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "pm",
  "--to", "manager",
  "--type", "task_done",
  "--subject", "产品文档已完成",
  "--content", "产品规格文档已写入 /mnt/shared/design/product_spec.md，请验收"
])
```

**标记消息完成：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "done",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "pm",
  "--msg-id", "msg-xxxxxxxx"
])
```

## 工作流程（严格按顺序）

1. **读取邮箱**（role=pm），找到 task_assign 消息，记录消息 id 和需求文件路径
2. **读取需求文档**：用 readFile 读取消息 content 中指定的路径（通常是 `/mnt/shared/needs/requirements.md`）
3. **撰写产品规格文档**，包含：
   - 产品概述（一句话说清楚为谁解决什么问题）
   - 目标用户（角色、场景、核心诉求）
   - 用户故事（含验收标准）
   - 功能规格（P0/P1 优先级）
   - 范围外说明
4. **写入共享工作区**：用 writeFile 写入 `/mnt/shared/design/product_spec.md`
5. **发 task_done 邮件**给 Manager，content 只写路径引用
6. **标记原消息为 done**，使用记录的消息 id
