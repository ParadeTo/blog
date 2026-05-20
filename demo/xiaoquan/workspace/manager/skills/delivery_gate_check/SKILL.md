---
name: delivery_gate_check
description: "Manager 交付前的业务门禁 skill。准备 send_to_human(kind=delivery) 前必须加载：读取 qa/test_status.json、qa/test_report.md、mailboxes 与 events，按 QA policy 和 RD/QA 时序决定 deliver / assign_rd / assign_qa。"
type: decision
---

# delivery_gate_check — 交付前业务门禁

## 目标

把“是否可以发给人类验收”的业务判断放在 skill 中，而不是写死在工具代码里。

工具层只负责读写、发信、执行测试；本 skill 负责判断：
- QA 是否真的通过
- QA policy 是否有被违反
- RD 修复之后是否必须重新测试
- 下一步应派给 RD、QA，还是可以交付

## 输入

- `projectId`
- 当前准备交付的上下文

## 必读文件

1. `qa/test_status.json`
2. `qa/test_report.md`
3. `mailboxes/manager.json`
4. `mailboxes/qa.json`
5. `mailboxes/rd.json`

## 判定规则

按顺序判断，命中即停止：

1. 缺 `qa/test_report.md` 或 `qa/test_status.json`
   - `decision=assign_qa`
   - 发 QA：`测试执行 / run tests`
   - 要求 QA 调 `run_project_tests`

2. `qa/test_status.json.status != "pass"`
   - 如果最新 RD `task_done` 晚于这次 QA status 的 `updatedAtMs`
     - `decision=assign_qa`
     - 发 QA：`测试执行 / retest`
   - 否则：
     - `decision=assign_rd`
     - 发 RD：`缺陷修复 / fix defects`
     - 附上 `qa/test_status.json.defects`

3. QA policy 失败
   - 如果 `qa/test_status.json.statusReason` 以 `disallowed_outcome:` 开头，视为 QA policy 失败
   - `decision=assign_rd`
   - 发 RD：`缺陷修复 / fix defects`
   - 例如当前 QA policy 可以禁止 `xfailed` / `xpassed`，但具体禁止项由 QA skill 传给 `run_project_tests`

4. 最新 RD `task_done` 晚于这次 QA pass
   - `decision=assign_qa`
   - 发 QA：`测试执行 / retest`
   - 原因：代码变更后必须重新测试

5. 以上都不命中
   - `decision=deliver`
   - 允许调用 `send_to_human(kind="delivery")`

## 输出格式

```json
{
  "decision": "deliver | assign_rd | assign_qa",
  "reason": "short_reason",
  "next_mail": {
    "to": "rd | qa",
    "type": "task_assign",
    "subject": "...",
    "content": "..."
  }
}
```

## 执行动作

- `decision=assign_rd`：调用 `send_mail(to="rd", type="task_assign", ...)`，然后 `append_event("revision_requested", ...)`，不要发 delivery。
- `decision=assign_qa`：调用 `send_mail(to="qa", type="task_assign", ...)`，然后 `append_event("revision_requested", ...)`，不要发 delivery。
- `decision=deliver`：再调用 `send_to_human(kind="delivery")`。

