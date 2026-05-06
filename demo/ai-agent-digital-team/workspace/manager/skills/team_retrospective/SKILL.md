---
name: team_retrospective
type: task
description: 团队复盘思考框架（Manager 专用）。当你收到 type=team_retro_trigger 的邮件时加载此 Skill。从聚合视角分析全员数据，发现跨 Agent 问题，级联触发瓶颈 Agent 的自我复盘，发周报给 Human。
---

# 团队复盘

## 你的任务

从全局视角分析所有 Agent 的运行状况，发现自我复盘看不到的跨 Agent 问题。

## 可用工具

通过 `run_script` 调用 `log_query/log-query.js`（按需使用，不限顺序）：

```
# 全员统计
run_script("log_query/log-query.js", ["all-agents", "--days", "7"])

# 单 Agent 任务列表
run_script("log_query/log-query.js", ["tasks", "--agent-id", "pm", "--days", "7", "--sort", "quality_asc"])

# 人类纠正记录
run_script("log_query/log-query.js", ["l1", "--days", "7"])
```

## 思考框架（非强制顺序）

1. **谁是瓶颈？** — 对比各 Agent 质量分布
2. **有没有跨 Agent 模式？** — 多个 Agent 犯同类错误 → 可能是共享规范问题
3. **协作接口健康吗？** — 邮件往返次数、交接失败率

## 完成后

1. 如发现瓶颈 Agent → 发 `retro_trigger` 邮件给该 Agent（通过 mailbox Skill）
2. 发周报给 Human：type=`weekly_report`，包含本周恶化指标 + 瓶颈 Agent + 改进方向

## 约束

- **不读 L3** — L3 是各 Agent 自己的工作域
- **不替 Agent 做复盘** — 级联触发后由 Agent 自己完成
