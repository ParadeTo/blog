# Multi-Agent Orchestrator 文章设计 Spec

## 元信息

- **系列定位：** AI Agent 系列第七篇，延续「简单实战一下」标题风格
- **文章标题：** 简单实战一下，Multi-Agent 的 Orchestrator 模式
- **预估字数：** ~4500 字 + 代码片段 + 2-3 张图
- **文件名：** `ai-agent-orchestrator.md`
- **参考材料：**
  - 极客时间第23课 PDF（Orchestrator 范式：任务层的主 Agent + 子 Agent）
  - CrewAI demo 代码（`/Users/youxingzhi/ayou/crewai_mas_demo/m4l23/m4l23_orchestrator.py`）
- **前置文章：** ai-agent-skill → ai-agent-skill-2 → （context/memory/rag 文章）→ ai-agent-final
- **读者预期：** 读完能理解 Orchestrator 是什么、为什么需要、怎么用，能跑通 demo 代码

---

## 文章结构

### 前言（~300字）

**目标：** 从前六篇的单 Agent 自然过渡到多 Agent 领域。

**内容要点：**
- 回顾系列脉络：Skill 系统 → ReAct 循环 → Context Engineering → 文件记忆 → RAG 长期记忆 → 飞书助手整合。一路下来 Agent 从"能听懂"到"能干活"。
- 但这一切在一个 Agent 的上下文里完成。当任务复杂到需要同时写前端、写后端、跑测试时，单个 Agent 会撞上三堵墙：
  - 效果瓶颈：上下文越长推理质量越差，单点处理有注意力上限
  - 性能瓶颈：串行执行，耗时随任务规模线性增长
  - 成本瓶颈：每轮全量处理，Token 消耗极高
- 剪裁和压缩（前面文章提到的 Context Engineering 手段）只是推迟问题，不是根治
- 引出本篇主题：Orchestrator 模式——让一个主 Agent 拆解调度，子 Agent 独立执行
- 提一句 Claude Code 就是这个模式的真实产品

**风格：** 延续前几篇的口语化第一人称，自然过渡。

---

### 一、三种协作模式对比（~600字 + 1张图）

**目标：** 讲清楚为什么 Orchestrator 是当前工程实践的主流收敛方向。

**内容要点：**

#### 1. Pipeline（顺序工作流）
- 工程师预先写死步骤1→2→3→4
- 优点：简单可控、容易调试
- 缺点：流程僵化，无法动态调整。如果步骤2发现问题需要改步骤1的设计，Pipeline 做不到

#### 2. Swarm（去中心化）
- Agent 之间点对点通信，没有中心协调者
- 理论上最灵活——每个 Agent 都能和其他 Agent 对话
- 实际工程问题：无协调中心导致误差叠加、验收困难。Google DeepMind 研究（AP-4）发现平铺 Agent 堆的误差是层级结构的 17 倍

#### 3. Orchestrator（有层级）
- 一个主 Agent 负责规划和调度，N 个子 Agent 独立执行
- 主 Agent **运行时决策**（不是预先写死）：根据需求动态决定派多少个子 Agent、什么角色、什么顺序
- 子 Agent 完成后把结果返回主 Agent 验收
- 三个核心优势：动态调度、上下文隔离、独立验收

**结论：** Orchestrator 是行业实践的收敛答案。Claude Code、Devin、Cursor 等产品背后都是这个模式。

**图：** 三栏对比图（Pipeline 纵向步骤链 / Swarm 全连接网 / Orchestrator 主+子树形结构），用 draw-diagram skill 制作 SVG+PNG。参考 PDF 第3页布局，用博客统一风格重绘。

---

### 二、Orchestrator 三个核心机制（~800字 + 1张图）

**目标：** 深入讲解 Orchestrator 如何用三个机制解决单 Agent 的三个瓶颈。

#### 机制1：上下文隔离（→ 解决效果瓶颈）

- 单 Agent 把所有信息塞进一个上下文，越做越长，推理质量下降
- Orchestrator 的做法：
  - 主 Agent 保留全局视角（需求概览 + 任务进度）
  - 子 Agent 只拿到自己任务需要的精准上下文
  - spawn 时**显式传递** context，不依赖隐式共享
- 结果传递方式：子 Agent 把产出写入文件，返回**文件路径**（不是文件内容）
  - 主 Agent 按需用 FileReadTool 读取
  - 300 行代码不回传到主 Agent 上下文，只传一个路径字符串

#### 机制2：并发执行（→ 解决性能瓶颈）

- 单 Agent 串行：耗时 = sum(所有步骤)
- Orchestrator 识别独立任务后并发执行：耗时 = max(并发组)
- 例子：接口设计和 Mock 先串行完成（有依赖），前端和后端再并发开发（互相独立）
- 关键约束：**共享规范必须在并发前确定**（先定接口 → 再并发写实现）

#### 机制3：验收机制（→ 解决质量问题）

- 执行者和评审者角色分离：子 Agent 执行，主 Agent 评审
- 不通过就 reject + retry：spawn 新的 Debugger 子 Agent 修复
- 避免无脑重试：每次重试必须附带：
  - 失败报告摘要
  - 主 Agent 的根因分析
  - 具体修改建议
- 同一失败模式重试仍相同，必须换策略（换任务描述、补充上下文、收窄范围）

**图：** 三栏并排展示三个机制，每栏用简洁的图示说明。用 draw-diagram skill 制作。

---

### 三、代码实战（~2000字 + 核心代码片段）

**目标：** 用可运行的代码展示 Orchestrator 模式的完整实现。

**场景：** 用一个"员工休假管理系统"作为示例需求（来自 demo 的 requirements.md），展示 Orchestrator 如何协调前端、后端、测试三个子 Agent 完成全栈开发。

**基于 demo 的简化和改进：**

1. **保留 CrewAI 框架**：它是 Multi-Agent 领域最流行的框架之一，读者可以直接用
2. **精简路径处理代码**：demo 中约 100 行的 `_resolve_workspace_path` / `_collapse_double_workspace_segment` 是 LLM 路径误写的防御性代码，文章中简单提一句，不详细贴
3. **突出核心抽象**：重点讲三个核心组件
4. **补充运行效果展示**：贴精简的运行日志

**代码讲解顺序：**

#### 3.1 动态 Sub-Crew 运行器（`_run_one_sub_crew`）

核心函数，每次调用实例化全新的 Agent/Task/Crew：
- role/goal/task/context 全部由主 Agent 在运行时传入
- 从预定义的 TOOL_REGISTRY 中按名称取工具
- 没有预定义的角色类——这是 Orchestrator 和 Pipeline 的核心区别
- 完成后返回文件路径字符串

贴 `_run_one_sub_crew` 函数代码（约 30 行），逐行解释关键设计。

#### 3.2 两个 Spawn 工具

**spawn_sub_agent（串行）：**
- 创建并运行一个子 Agent，等待完成后返回
- 适用于有依赖关系的任务（如先设计再开发）
- 输入参数：role, goal, task, context, tool_names, output_file

**spawn_sub_agents_parallel（并发）：**
- 用 ThreadPoolExecutor 并发启动多个独立子 Agent
- 全部完成后返回 JSON 结果
- 适用于互相独立的任务（如前端和后端同时开发）
- 输入：JSON 数组，每项与 spawn_sub_agent 参数相同

贴两个 Tool 的核心代码（精简版，去掉 Pydantic schema 定义的细节）。

#### 3.3 主 Agent（Orchestrator）的 Prompt 设计

这是本文的一个亮点——主 Agent 的 backstory 中注入了 SOP Skill 文件：
- SOP 定义了完整的软件交付流程（设计 → Mock → 开发 → 测试 → 修复 → 交付）
- 主 Agent 按 SOP 流程推进，不中断不提问
- backstory 中还包含排障思维指导（分清层次、可复现优先、一次只改一个变量）

讲 `build_orchestrator` 函数的设计，重点展示 prompt 构成。

#### 3.4 运行效果

贴一段精简的运行日志（来自实际运行或模拟），展示完整链路：
1. 主 Agent 读取需求文档
2. spawn 架构设计子 Agent → 产出 architecture.md
3. spawn 接口设计子 Agent → 产出 api_spec.md
4. 主 Agent 验收通过
5. spawn Mock 工程师 → 产出 mock + 单测
6. 并发 spawn 前端 + 后端开发 → 产出 frontend/index.html + backend/main.py
7. 主 Agent 验收，发现问题 → reject → spawn Debugger 修复
8. 最终验收通过 → 产出 delivery_report.md

用简短注释标注每个步骤对应的核心机制（上下文隔离/并发执行/验收机制）。

---

### 四、最佳实践与反模式（~500字）

**目标：** 帮读者在实际项目中避坑。

**反模式（别做）：**

| 反模式 | 说明 | 来源 |
|--------|------|------|
| 无 kill switch | 无预算上限+无终止条件，Agent 循环调用直到配额耗尽。HN 案例：$600 账单 | HackerNews |
| 规划错误放大 | 主 Agent 规划出错，每个子 Agent 都在错误前提下执行 | 工程实践 |
| 并行写冲突 | 共享规范没定好就并发，产物无法调和 | Cognition/Devin 博客 |
| 平铺无层级 | Agent 平铺堆叠，误差 17 倍放大 | Google DeepMind AP-4 |

**最佳实践（该做）：**

| 实践 | 说明 | 来源 |
|------|------|------|
| 先跑单 Agent | 从单 Agent 跑通，证明有并发收益再拆 | HN 工程社区 |
| 执行评审分离 | 独立验收不带执行包袱，客观评判 | 通用原则 |
| 每步 ≥99% 可靠 | 可靠性指数衰减，10 个 95% 的步骤串联只有 60% | Galileo 推导 |
| 显式传递上下文 | 不假设 Agent 间自动知晓 | Anthropic 案例 |

---

### 五、总结（~200字）

**内容要点：**
- 一句话总结：Orchestrator = 主 Agent（拆解+调度+验收）+ N * 子 Agent（独立执行），通过文件路径传递结果
- 回扣系列主线：前六篇让一个 Agent 越来越强，这篇开始让多个 Agent 协作
- 适用场景判断：任务能自然分解为独立子任务 + 有并发收益 → 用 Orchestrator；否则单 Agent 就够了
- 简单展望下一步方向（可选）

---

## 配图清单

| 编号 | 位置 | 内容 | 制作方式 |
|------|------|------|----------|
| 图1 | 第一节 | 三种协作模式对比（Pipeline/Swarm/Orchestrator 三栏并排） | draw-diagram skill: SVG → PNG |
| 图2 | 第二节 | 三个核心机制（上下文隔离/并发执行/验收机制 三栏并排） | draw-diagram skill: SVG → PNG |
| 图3 | 第三节（可选） | 代码实战流程图（主 Agent 调度全流程：串行设计→并发开发→验收修复） | draw-diagram skill: SVG → PNG |

---

## 技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 框架 | CrewAI | Multi-Agent 领域最流行的 Python 框架，demo 已有实现 |
| 代码展示方式 | 核心片段+注释，完整代码放 GitHub | 文章篇幅可控，读者可以选择深入 |
| LLM 选择 | 保留 demo 的 Aliyun/Qwen 配置 | 国内读者易获取，降低跑通门槛 |
| 图片风格 | draw-diagram skill 手写 SVG | 与系列前几篇风格统一 |
