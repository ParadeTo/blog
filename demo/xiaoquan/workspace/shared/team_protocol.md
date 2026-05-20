# 小圈小队协作通用约定

## Kickoff 两步法（每次被邮箱文件监听唤醒必须执行）

1. **解析 project_id**：从 wake 消息中提取项目 ID
   - 格式：`__wake__:new_mail:{project_id}` → project_id = 消息中的 projectId
2. **读取邮件**：调用 `read_inbox(projectId)` 读取自己的未读邮件

## 邮件处理流程

1. `read_inbox` → 获取 unread 邮件（自动转 in_progress）
2. 处理邮件内容（执行任务）
3. `mark_done(msgId)` → 标记邮件完成
4. 若需要通知其他人 → `send_mail`（写入收件箱后由文件监听自动唤醒收件方）

## 邮件类型约定

| 类型 | 说明 |
|------|------|
| task_assign | 上级分配任务 |
| task_done | 完成任务回报（必须带 deliverables + self_score） |
| review_request | 请求评审 |
| review_done | 评审完成（带评审结论） |
| clarification_request | 请求澄清信息 |
| clarification_answer | 澄清回答 |
| retro_trigger | 触发复盘（Manager → 所有角色） |
| retro_report | 复盘报告（各角色 → Manager） |

## 防只说不做

**必须**实际调用工具：
- 说"已写文档" → 必须已调 `write_shared`
- 说"已发邮件" → 必须已调 `send_mail`
- 说"已创建项目" → 必须已调 `create_project`
- 说"已标记完成" → 必须已调 `mark_done`

## 共享目录权限

| 目录 | Owner | 说明 |
|------|-------|------|
| needs/ | manager | 需求文档 |
| design/ | pm | 产品规格 |
| tech/ | rd | 技术设计 |
| code/ | rd | 代码实现 |
| qa/ | qa | 测试文件 |
| reviews/ | 评审方 | 交叉评审（文件名含评审者角色） |

## task_done 邮件格式

```json
{
  "deliverables": ["design/product_spec.md"],
  "self_score": {
    "overall": 0.85,
    "breakdown": {
      "completeness": 1.0,
      "selfReview": 0.8,
      "hardConstraints": 1.0,
      "clarity": 0.7,
      "timeliness": 0.8
    }
  },
  "notes": "可选：补充说明"
}
```
