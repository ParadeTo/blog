---
name: notify_human
type: reference
description: 通知 Human 在关键节点介入确认。规定何时通知、何时不通知、通知类型和内容格式。
---

# 通知 Human

## 单一接口原则

**只有 Manager 可以向 human.json 发消息**。PM 不能直接联系 Human——mailbox_cli.js 会校验 --from 字段，非 manager 发送会被拒绝（errcode=1）。

## 通知类型

| type | 触发时机 |
|------|---------|
| needs_confirm | 需求文档写好后，请 Human 确认 |
| sop_draft_confirm | SOP 草稿完成后，请 Human 审阅 |
| sop_confirm | SOP 选定后，请 Human 确认 |
| checkpoint_request | 关键交付物完成后，请 Human 审阅 |
| error_alert | 遇到无法自行处理的异常 |

## 何时通知（必须通知）

- 需求文档写好后（needs_confirm）
- SOP 选定后（sop_confirm）
- 遇到连续工具失败、超出授权操作等异常（error_alert）

## 何时不通知（禁止打扰）

- Manager ↔ PM 之间的常规邮件往来
- 不需要决策的常规进度步骤

## 发送方式

```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "human",
  "--type", "{type}",
  "--subject", "{简洁主题，不超过15字}",
  "--content", "{文件路径 + 1-2句说明}"
])
```

## 检查 Human 是否已确认

```
run_script("mailbox/scripts/mailbox_cli.js", [
  "check-human",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--type", "{type}"
])
```

返回 `{"confirmed": true}` 表示已确认可继续推进；`{"confirmed": false}` 表示未确认，本轮结束等待。

## 发送后

**不要阻塞等待**。发完消息后完成当前能做的事然后结束本轮。Human 会通过 human-cli.js 回复，下次运行时再检查确认状态。
