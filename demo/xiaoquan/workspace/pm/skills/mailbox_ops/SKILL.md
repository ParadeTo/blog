---
name: mailbox_ops
description: "团队邮箱操作（读自己 inbox 或给其他角色发邮件）。直接调用 send_mail / read_inbox / mark_done 工具，不要手动操作 JSON 文件。"
type: task
---

# mailbox_ops — 团队邮箱操作

## ⚠️ 执行方式（强约束）

**直接调用工具**，不要手动读写 JSON 文件（后者会破坏并发锁 + 格式约定）。

## 可用工具

### 1. 发邮件给其他角色

调用 `send_mail` 工具，参数：
- `to`：收件方角色，枚举 `manager | pm | rd | qa`
- `type`：邮件类型，枚举 `task_assign | task_done | review_request | review_done | retro_trigger | retro_report | retro_approved | retro_rejected | retro_applied | retro_apply_failed | clarification_request | clarification_answer | error_alert`
- `subject`：邮件主题（字符串）
- `content`：邮件内容（JSON 对象或字符串）
- `project_id`：当前项目 ID

发送后工具会自动唤醒收件方，无需额外操作。

### 2. 读自己的 inbox

调用 `read_inbox` 工具，参数：
- `project_id`：当前项目 ID

返回所有 unread 邮件（并自动将其标记为 in_progress）。

### 3. 标记邮件处理完成

调用 `mark_done` 工具，参数：
- `project_id`：当前项目 ID
- `msg_id`：邮件 ID（从 read_inbox 返回的 `id` 字段）

## 工具返回格式

所有工具返回 JSON 字符串：

```json
{"errcode": 0, "errmsg": "success", "data": {"msg_id": "msg-a1b2c3d4"}}
```

- `errcode=0` 表示成功；非 0 失败，`errmsg` 含具体错误
- `data` 里是子命令特定数据（`msg_id` / `messages` 数组等）

## 典型流程

**Manager 派任务给 PM**：
1. 调用 `send_mail` 工具，to=pm type=task_assign
2. 确认 errcode == 0
3. 把返回的 msg_id 记住（后续 mark_done 会用）
4. 结束 skill，回主 Agent 继续
