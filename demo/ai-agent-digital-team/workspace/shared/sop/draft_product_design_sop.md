# 产品设计 标准操作流程（SOP）

## 角色分工

| 角色 | 职责 |
|------|------|
| Manager | 初始化工作区，澄清需求，分配任务给 PM，验收 PM 产出 |
| PM | 读取需求文档，产出产品规格文档，完成后回邮通知 Manager |
| Human | 确认需求文档，审阅关键交付物（SOP / 产品规格文档） |

---

## 执行步骤

| 步骤 | 执行者 | 操作 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | Manager | 初始化工作区，接收并澄清原始需求，写入需求文档 | 用户原始需求 | `/mnt/shared/needs/requirements.md` |
| 2 | Human | 审阅并确认需求文档 | `requirements.md` | 确认 / 拒绝（附修改意见） |
| 3 | Manager | 从 SOP 库选定流程模板，写入 active_sop.md | SOP 模板库 | `/mnt/shared/sop/active_sop.md` |
| 4 | Human | 审阅并确认 SOP 选择 | `active_sop.md` | 确认 / 拒绝（附修改意见） |
| 5 | Manager | 向 PM 发送 task_assign 邮件，附需求文档路径 | `requirements.md` | task_assign 邮件 |
| 6 | PM | 阅读需求文档，产出产品规格文档，回邮 Manager | `requirements.md` | `/mnt/shared/design/product_spec.md` |
| 7 | Manager | 验收 PM 产出，对照验收标准逐项检查，写入验收结果 | `product_spec.md` | `/mnt/shared/design/review_result.md` |
| 8 | Human | 审阅最终产品规格文档及验收结果 | `product_spec.md` + `review_result.md` | 确认完成 / 要求返工 |

---

## Checkpoint

| Checkpoint | 触发时机 | 确认内容 | 未通过时的处理 |
|------------|---------|---------|--------------|
| CP1 | 步骤 1 完成后（需求文档写好） | 需求是否准确、完整、无歧义 | Manager 根据反馈修改，重新发起确认（最多 3 轮） |
| CP2 | 步骤 3 完成后（SOP 选定） | 流程设计是否符合本次项目实际 | Manager 重新选模板或触发 sop_creator 创建新模板 |
| CP3 | 步骤 7 完成后（验收结果出炉） | 产品规格文档是否达到业务目标 | Manager 将问题清单回邮 PM，要求修订后重新验收 |

---

## 质量标准

| 交付物 | 验收标准 |
|--------|---------|
| 需求文档（`requirements.md`） | 包含目标、边界（范围内/外）、约束、风险四个维度；待澄清项已列出或标注"无" |
| 产品规格文档（`product_spec.md`） | 包含完整用户故事（As / I want / So that）、功能列表、每条功能的验收标准（AC）、非功能性需求 |
| 验收结果（`review_result.md`） | 逐条对照验收标准，明确标注"通过 / 不通过"，不通过项附具体问题描述 |

---

## 文件路径约定

| 文件 | 宿主机路径 | 容器内路径 |
|------|-----------|-----------|
| 需求文档 | `.../workspace/shared/needs/requirements.md` | `/mnt/shared/needs/requirements.md` |
| 当前 SOP | `.../workspace/shared/sop/active_sop.md` | `/mnt/shared/sop/active_sop.md` |
| 产品规格文档 | `.../workspace/shared/design/product_spec.md` | `/mnt/shared/design/product_spec.md` |
| 验收结果 | `.../workspace/shared/design/review_result.md` | `/mnt/shared/design/review_result.md` |

---

## 备注

- 本 SOP 适用场景：**接收需求 → PM 完成产品规格文档 → Manager 验收**
- 每个 Checkpoint 均须 Human 显式确认后方可进入下一阶段，不得跳过
- Manager 不得亲自撰写产品文档；PM 不得直接联系 Human
