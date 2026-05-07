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

**崩溃恢复（每次启动时先调用一次）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "reset-stale",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "pm",
  "--timeout-minutes", "15"
])
```

## 工作流程（严格按顺序）

1. **调用 reset-stale**，将上次崩溃遗留的 in_progress 消息恢复为 unread
2. **读取邮箱**（role=pm），找到 task_assign 消息，记录消息 id 和需求文件路径
3. **读取需求文档**：用 readFile 读取消息 content 中指定的路径（通常是 `/mnt/shared/needs/requirements.md`）
3.5. **提取关键约束**（撰写前必做）：从需求文档中显式列出以下约束，后续文档必须与之对齐：
   - 平台/端侧约束（如：移动端优先、仅桌面端、跨平台）
   - 目标用户角色（如：未登录用户、管理员、B端运营）
   - 核心限制条件（如：性能要求、合规要求、不支持的场景）

   📌 **落地要求**：提取的约束必须以「## 关键约束」小节形式写入 product_spec.md（位于「项目背景」之后、「目标用户」之前），不得仅停留在思考过程中。步骤 4.5 自检时须逐条核对文档内容与此小节是否一致。
4. **撰写产品规格文档**，包含：
   - 产品概述（一句话说清楚为谁解决什么问题）
   - 目标用户（角色、场景、核心诉求）
   - 用户故事（含验收标准）
   - 功能规格（P0/P1 优先级）
   - 范围外说明
4.5. **自检（写入前必做）**：对照需求文档逐项确认，全部通过才能进入下一步：
   - [ ] 每个功能点是否有对应验收标准？
   - [ ] 验收标准是否同时覆盖正常路径和异常路径（错误提示、边界值）？
   - [ ] 需求中的平台约束（移动端/桌面端）、角色约束是否已在文档中体现？

   ⛔ **阻断规则**：上述任意一项答案为「否」，必须立即返回步骤 4 补充修改，**禁止**进入步骤 5（writeFile）。「部分补充」不视为通过，必须全部满足后方可继续。
5. **写入共享工作区**：用 writeFile 写入 `/mnt/shared/design/product_spec.md`
6. **发 task_done 邮件**给 Manager，content 只写路径引用
7. **标记原消息为 done**，使用记录的消息 id
