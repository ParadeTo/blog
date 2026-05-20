我要写一篇新的文章，主题暂定为“让 Agent 学会自动刹车：重试、循环控制与成本围栏”。

请基于这个资料：

./31-reliability-retry-loop-cost.md

和代码：

/Users/youxingzhi/ayou/crewai_mas_demo/m5l31

要求：

1. 不要照抄极客时间原文。
2. 重点结合代码讲清楚 Hook 如何从“观测”升级成“干预”。
3. 文章里要解释 `GuardrailDeny`、`pending_deny`、`RetryTracker`、`CostGuard`、`LoopDetector`。
4. 参考上面代码，实现一个 js 版本的
5. 写文章时必须使用 `write-tech-article` skill。
6. 文章观点可以落在：可靠性防“蠢”，安全性防“骗”；不要把业务门禁散落在主流程，而是策略化、Hook 化。
