---
name: self_score
description: "任务自评 5 维打分。每次在发 task_done 前无条件调用；按 completeness/self_review/hard_constraints/clarity/timeliness 5 维各打 0-1 分，加权得总分。输出 JSON 给 task_callback 解析写 L2 日志"
type: reference
---

# self_score — 任务自评框架

## 何时调用
**每次任务即将完成前**（即将发 `type=task_done` 邮件之前），调这个 skill，按下面 5 维打分。

## 5 维评分标准

| 维度 | 权重 | 打分标准（0-1） |
|------|------|---|
| **completeness** | 0.20 | 产物完整性：所有模板必填字段都填了 / 产物文件非空、size ≥ 基线 |
| **self_review** | 0.30 | 自查通过率：self-review checklist 过了几项 / 总项 |
| **hard_constraints** | 0.20 | 硬约束合规：是否违反 SKILL.md 里的"硬约束"（违反一条 ≤ 0.5） |
| **clarity** | 0.15 | 清晰度：后续角色能否直接理解使用 |
| **timeliness** | 0.15 | 时效：是否在预期时间内、未超重试上限 |

总分公式：`self_score = 0.2*completeness + 0.3*self_review + 0.2*hard_constraints + 0.15*clarity + 0.15*timeliness`

## 输出格式（严格）

在你的 task_done 邮件 content 里，以及你的最终回复里，都要带这段 JSON：

```json
{
  "self_score": 0.82,
  "breakdown": {
    "completeness": 1.0,
    "self_review": 0.9,
    "hard_constraints": 1.0,
    "clarity": 0.7,
    "timeliness": 0.8
  },
  "rationale": "产物完整 / 自查过了 9 / 10 项；硬约束合规；清晰度略扣是因为 edge case 描述偏简；时效接近上限"
}
```

## 约束

- 任何一维分数 >0.9 时，rationale 必须具体说明"为什么满分"
- 硬约束违反 → hard_constraints **必** ≤ 0.5
- 精确到 2 位小数
