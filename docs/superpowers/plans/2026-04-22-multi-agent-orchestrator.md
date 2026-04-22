# Multi-Agent Orchestrator 文章实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 撰写 AI Agent 系列第七篇博客文章「简单实战一下，Multi-Agent 的 Orchestrator 模式」，包含 2-3 张配图。

**Architecture:** 使用 write-tech-article skill 的工作流（跳过大纲确认步骤，因为 spec 已确认）。配图使用 draw-diagram skill 手写 SVG → puppeteer 渲染 PNG。文章保存至 `source/_posts/ai-agent-orchestrator.md`，配图放入 `source/_posts/ai-agent-orchestrator/` 目录。

**Tech Stack:** Hexo Markdown / SVG / puppeteer-core (Chrome) / node render.mjs

---

## 文件结构

| 文件 | 用途 |
|------|------|
| `source/_posts/ai-agent-orchestrator.md` | 文章正文 |
| `source/_posts/ai-agent-orchestrator/compare.svg` | 图1 SVG 源文件（临时，渲染后删除） |
| `source/_posts/ai-agent-orchestrator/compare.png` | 图1：三种协作模式对比 |
| `source/_posts/ai-agent-orchestrator/mechanism.svg` | 图2 SVG 源文件（临时，渲染后删除） |
| `source/_posts/ai-agent-orchestrator/mechanism.png` | 图2：三个核心机制 |
| `source/_posts/ai-agent-orchestrator/flow.svg` | 图3 SVG 源文件（临时，渲染后删除） |
| `source/_posts/ai-agent-orchestrator/flow.png` | 图3：代码实战全流程 |
| `source/_posts/ai-agent-orchestrator/render.mjs` | 渲染脚本（临时，用完删除） |

---

### Task 1: 创建文章文件 + 撰写前言

**Files:**
- Create: `source/_posts/ai-agent-orchestrator.md`

- [ ] **Step 1: 创建文章目录和文件**

```bash
mkdir -p ~/ayou/blog/source/_posts/ai-agent-orchestrator
```

- [ ] **Step 2: 撰写 frontmatter + 前言**

写入 `source/_posts/ai-agent-orchestrator.md`，内容如下：

```markdown
---
title: 简单实战一下，Multi-Agent 的 Orchestrator 模式
date: 2026-04-22 10:00:00
tags:
  - ai
  - agent
  - multi-agent
categories:
  - ai
description: 单 Agent 做复杂任务会撞上效果、性能、成本三堵墙。Orchestrator 模式用主 Agent 拆解调度 + 子 Agent 独立执行来解决，本文讲原理、看代码、跑效果。
---

## 前言

（约 300 字，要点如下）
- 回顾前六篇系列脉络：Skill → ReAct → Context → 记忆 → RAG → 飞书助手
- 点出单 Agent 的三堵墙：效果瓶颈（上下文越长推理越差）、性能瓶颈（串行执行耗时线性增长）、成本瓶颈（每轮全量处理 Token 飙升）
- 剪裁压缩只是推迟问题，不是根治
- 引出 Orchestrator：主 Agent 拆解调度，子 Agent 独立执行
- 提 Claude Code 是这个模式的真实产品
```

**写作要求：**
- 延续前几篇口语化第一人称风格
- 参考 `ai-agent-final.md` 前言的衔接方式（"这个系列写到现在，前X篇分别聊了……"）
- 不要用 AI 高频词（此外、至关重要、深入探讨等）
- 不要三段并列，两项或四项
- 一段最多一个破折号

- [ ] **Step 3: 验证文件格式**

```bash
head -15 ~/ayou/blog/source/_posts/ai-agent-orchestrator.md
```

确认 frontmatter 包含 title、date、tags、categories、description 五个字段。

- [ ] **Step 4: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git commit -m "feat: add orchestrator article with introduction"
```

---

### Task 2: 绘制图1——三种协作模式对比

**Files:**
- Create: `source/_posts/ai-agent-orchestrator/compare.svg`
- Create: `source/_posts/ai-agent-orchestrator/compare.png`
- Create: `source/_posts/ai-agent-orchestrator/render.mjs`（临时）

**参考：** PDF 第3页三栏对比图 + `source/_posts/ai-agent-skill-2/flow.svg` 的视觉风格。

- [ ] **Step 1: 编写 compare.svg**

SVG 宽 880，三栏并排布局：

**左栏：Pipeline（顺序工作流）**
- 标题「顺序工作流」+ 标签「流程僵化」（用警告色 `#f0a500`）
- 纵向4个步骤节点（步骤1→2→3→4），用标准处理节点样式（白底 + `#4361ee` 边框）
- 直线箭头连接
- 底部红色提示框：「子任务全部提前编排，无法动态调整」

**中栏：Swarm（去中心化）**
- 标题「Swarm 去中心化」+ 标签「难以收敛」（用警告色）
- 5-6个 Agent 圆形节点（用 `#f0a500` 边框），全连接双向箭头（用虚线，避免太密集）
- 底部红色提示框：「无协调中心，误差叠加，验收困难」

**右栏：Orchestrator（有层级）**
- 标题「Orchestrator 有层级」+ 标签「行业收敛」（用成功色 `#2ec4b6`）
- 顶部一个大的主 Agent 节点（药丸形，`#4361ee` 填充）
- 标注「运行时决策」
- 下方三个子 Agent 节点（圆角矩形，`#2ec4b6` 边框），分别标注 A/B/C
- 主→子用实线箭头，子→主用虚线回传
- 底部绿色提示框：「动态调度，上下文隔离，独立验收」

SVG 必须遵循 draw-diagram skill 规范：
- `<defs>` 中定义 arrow marker 和 shadow filter
- 浅灰背景 `#f8f9fa`
- 字体 `PingFang SC, Arial, sans-serif`
- 所有连线用 `<line>` 或 `<path>` + `marker-end`，不用文字箭头

- [ ] **Step 2: 创建 render.mjs**

在 `source/_posts/ai-agent-orchestrator/` 目录下创建渲染脚本（内容见 draw-diagram skill 的渲染脚本模板）。

- [ ] **Step 3: 渲染 PNG**

```bash
cd ~/ayou/blog/source/_posts/ai-agent-orchestrator
node render.mjs compare.svg
```

确认输出 `compare.png` 且大小合理（通常 50K-200K）。

- [ ] **Step 4: 验证图片**

用 Read 工具打开 `compare.png` 检查渲染效果：
- 三栏是否对齐
- 文字是否清晰
- 连线是否正确
- 没有重叠或遮挡

如有问题，修改 SVG 后重新渲染。

- [ ] **Step 5: Commit（保留 SVG，最终清理在 Task 8）**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator/compare.png source/_posts/ai-agent-orchestrator/compare.svg
git commit -m "feat: add three-mode comparison diagram"
```

---

### Task 3: 撰写第一节——三种协作模式对比

**Files:**
- Modify: `source/_posts/ai-agent-orchestrator.md`

- [ ] **Step 1: 在前言之后追加第一节**

章节标题：`## 一、三种协作模式`

内容约 600 字，要点：

1. **开头**：从单 Agent 的瓶颈引出"为什么需要多个 Agent 协作"
2. **Pipeline**（~150字）：工程师预先写死步骤链。简单可控，但流程僵化，无法动态调整
3. **Swarm**（~150字）：Agent 间点对点通信，无中心协调。理论灵活但工程上误差叠加。Google DeepMind 研究发现平铺 Agent 堆误差是层级结构的 17 倍
4. **Orchestrator**（~200字）：主 Agent 运行时决策 + 子 Agent 独立执行。动态调度、上下文隔离、独立验收
5. 插入图片引用：`![](compare.png)`
6. **收尾**：一句话总结 Orchestrator 是行业收敛方向，Claude Code、Devin 等产品背后都是这个模式

**写作注意：**
- 三种模式的描述不要变成表格或列表堆砌，用段落叙述
- 每种模式先说是什么，再说优缺点
- Orchestrator 的描述要比前两种更详细（它是主角）

- [ ] **Step 2: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git commit -m "feat: add section 1 - three collaboration modes comparison"
```

---

### Task 4: 绘制图2——三个核心机制

**Files:**
- Create: `source/_posts/ai-agent-orchestrator/mechanism.svg`
- Create: `source/_posts/ai-agent-orchestrator/mechanism.png`

**参考：** PDF 第5页三栏机制图。

- [ ] **Step 1: 编写 mechanism.svg**

SVG 宽 880，三栏并排布局：

**左栏：上下文隔离**
- 标题「上下文隔离」
- 上方：主 Agent 节点（大，`#4361ee`），标注「全局视角」
- 剪刀图标或分割线
- 下方：三个子 Agent 小节点，每个标注「精准上下文」
- 对比说明：✗ 单 Agent 全量上下文 / ✓ 子 Agent 精准上下文

**中栏：并发执行**
- 标题「并发执行」
- 上方：Orchestrator 节点
- 下方：三个并行条（Agent A/B/C），用甘特图风格表示并行执行
- 对比说明：✗ 串行时间叠加 / ✓ 并发时间重叠

**右栏：验收机制**
- 标题「验收机制」
- 主 Agent 节点（评审方）
- 子 Agent 输出 → 主 Agent 判断（菱形）→ ACCEPT/REJECT 两条路径
- REJECT 路径回到子 Agent「重试/修复」
- ACCEPT 路径到「交付」

SVG 遵循 draw-diagram skill 规范。

- [ ] **Step 2: 渲染 PNG**

```bash
cd ~/ayou/blog/source/_posts/ai-agent-orchestrator
node render.mjs mechanism.svg
```

- [ ] **Step 3: 验证图片**

用 Read 工具检查渲染效果。如有问题修改后重新渲染。

- [ ] **Step 4: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator/mechanism.png source/_posts/ai-agent-orchestrator/mechanism.svg
git commit -m "feat: add three core mechanisms diagram"
```

---

### Task 5: 撰写第二节——Orchestrator 三个核心机制

**Files:**
- Modify: `source/_posts/ai-agent-orchestrator.md`

- [ ] **Step 1: 追加第二节**

章节标题：`## 二、三个核心机制`

内容约 800 字，三个子节：

**1. 上下文隔离（解决效果瓶颈）（~250字）**
- 单 Agent 把所有信息塞进一个上下文的问题
- Orchestrator 做法：主 Agent 保留全局视角，子 Agent 只拿到精准上下文
- spawn 时显式传递 context，不依赖隐式共享
- 文件路径回传机制：子 Agent 写文件返回路径，不传内容。300 行代码只传一个路径字符串
- 为后面代码实战中的 `output_file` 参数做铺垫

**2. 并发执行（解决性能瓶颈）（~250字）**
- 串行 vs 并发的时间差异
- 例子：先串行完成接口设计和 Mock（有依赖），再并发开发前后端（互相独立）
- 关键约束：共享规范必须在并发前确定
- 为后面代码实战中的 `spawn_sub_agents_parallel` 做铺垫

**3. 验收机制（解决质量问题）（~300字）**
- 执行者和评审者分离
- reject + retry 流程
- 避免无脑重试：每次重试附带失败摘要、根因分析、修改建议
- 同一失败模式须换策略

插入图片引用：`![](mechanism.png)`

**写作注意：**
- 每个机制先说"单 Agent 的问题"，再说"Orchestrator 怎么解决"
- 自然衔接到下一节代码实战（"概念讲完了，下面看代码"之类的过渡）

- [ ] **Step 2: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git commit -m "feat: add section 2 - three core mechanisms"
```

---

### Task 6: 撰写第三节——代码实战

**Files:**
- Modify: `source/_posts/ai-agent-orchestrator.md`

**参考代码：** `/Users/youxingzhi/ayou/crewai_mas_demo/m4l23/m4l23_orchestrator.py`

- [ ] **Step 1: 追加第三节开头 + 3.1 动态 Sub-Crew 运行器**

章节标题：`## 三、代码实战`

开头简要说明：用一个"员工休假管理系统"的需求来演示。技术栈是 Python + CrewAI 框架。

子节 `### 1. 动态 Sub-Crew 运行器`（~400字）

核心内容：展示 `_run_one_sub_crew` 函数的精简版代码。

从 demo 中提取并简化的代码（去掉路径修正逻辑，保留核心）：

```python
from crewai import Agent, Crew, Task

TOOL_REGISTRY = {
    "FileReadTool":   FileReadTool(),
    "FileWriterTool": FileWriterTool(),
    "BashTool":       BashTool(),
}

def _run_one_sub_crew(role, goal, task, context, tool_names, output_file):
    tools = [
        TOOL_REGISTRY[t.strip()]
        for t in tool_names.split(",")
        if t.strip() in TOOL_REGISTRY
    ]
    agent = Agent(
        role=role, goal=goal, backstory=context,
        tools=tools, llm=get_llm(), verbose=True,
    )
    task_obj = Task(
        description=task,
        expected_output=f"将结果写入 {output_file}，返回该文件路径",
        agent=agent, output_file=output_file,
    )
    Crew(agents=[agent], tasks=[task_obj], verbose=True).kickoff()
    return output_file
```

讲解要点：
- 每次调用都实例化**全新的** Agent/Task/Crew——上下文隔离的关键
- role/goal/task/context 全部由调用方在运行时决定——没有预定义的角色类
- 从 TOOL_REGISTRY 按名称取工具——工具池预定义，分配由主 Agent 决定
- 返回文件路径——不传内容回主 Agent

- [ ] **Step 2: 追加 3.2 两个 Spawn 工具**

子节 `### 2. 串行与并发`（~400字）

展示两个 Tool 的精简代码：

**spawn_sub_agent（串行）：**

```python
class SpawnSubAgentTool(BaseTool):
    name = "spawn_sub_agent"
    description = "动态创建并运行一个子 Agent（串行）"

    def _run(self, role, goal, task, context, tool_names, output_file):
        return _run_one_sub_crew(
            role=role, goal=goal, task=task,
            context=context, tool_names=tool_names,
            output_file=output_file,
        )
```

**spawn_sub_agents_parallel（并发）：**

```python
class SpawnParallelTool(BaseTool):
    name = "spawn_sub_agents_parallel"
    description = "并发启动多个独立子 Agent"

    def _run(self, subtasks_json):
        subtasks = json.loads(subtasks_json)
        results = {}
        with ThreadPoolExecutor(max_workers=len(subtasks)) as executor:
            futures = {
                executor.submit(_run_one_sub_crew, **st): st["output_file"]
                for st in subtasks
            }
            for future in as_completed(futures):
                output_file = futures[future]
                try:
                    results[output_file] = future.result()
                except Exception as e:
                    results[output_file] = f"error: {e}"
        return json.dumps(results, ensure_ascii=False)
```

讲解要点：
- 串行工具等待完成后返回，适用于有依赖的任务
- 并发工具用 ThreadPoolExecutor，全部完成后返回 JSON
- 并发的前提：各任务输入不依赖对方输出，输出目录不重叠
- 错误捕获：一个失败不影响其他任务

- [ ] **Step 3: 追加 3.3 主 Agent 的 Prompt 设计**

子节 `### 3. 主 Agent 的 Prompt 设计`（~500字）

展示 `build_orchestrator` 函数的精简版：

```python
def build_orchestrator():
    sop = Path("skills/software-dev-sop/SKILL.md").read_text()

    orchestrator = Agent(
        role="Software Development Orchestrator",
        goal="接收需求，协调子 Agent 完成设计、实现、测试与交付",
        backstory=(
            "你是一名有 10 年全栈经验的技术负责人。\n"
            "你的工作方式：\n"
            "1. 架构/代码/报告一律由子 Agent 产出——你只派单和验收\n"
            "2. 给子 Agent 派任务时，显式传递全部信息\n"
            "3. 独立的任务用并发；有依赖的严格串行\n"
            "4. 按照 SOP 流程推进，不跳过任何阶段\n"
            "5. 失败时先分析根因再 spawn，不无脑重试\n\n"
            f"━━━ SOP 流程 ━━━\n{sop}"
        ),
        tools=[SpawnSubAgentTool(), SpawnParallelTool(), FileReadTool()],
        llm=get_llm("qwen-max"),
    )
    return orchestrator
```

讲解要点：
- backstory 中注入 SOP Skill 文件——用 Skill 驱动 Orchestrator 行为（呼应系列第一篇 Skill 系统）
- 主 Agent 只有三个工具：spawn 串行、spawn 并发、读文件验收
- 不执笔任何文档或代码——"你只做拆解、派单、验收"
- 失败时"先分析再派单"——体现验收机制

- [ ] **Step 4: 追加 3.4 运行效果**

子节 `### 4. 运行效果`（~400字）

展示精简的运行日志，格式如下：

```text
========== Orchestrator 启动 ==========

[主 Agent] 读取 requirements.md...

[sub-agent: 架构设计师] 启动 (独立上下文)     ← 串行：先定架构
[sub-agent: 架构设计师] 完成 → design/architecture.md
[主 Agent] 验收 architecture.md ✓

[sub-agent: 接口设计师] 启动 (独立上下文)     ← 串行：再定接口
[sub-agent: 接口设计师] 完成 → design/api_spec.md
[主 Agent] 验收 api_spec.md ✓

[sub-agent: Mock 工程师] 启动 (独立上下文)    ← 串行：接口定了才能 Mock
[sub-agent: Mock 工程师] 完成 → mock/api_mock.py + tests/
[主 Agent] 验收 Mock ✓

[并发启动] 2 个子 Agent 同时运行...          ← 并发：前后端独立
  [前端 Developer] 启动 (独立上下文)
  [后端 Developer] 启动 (独立上下文)
  [完成] → frontend/index.html
  [完成] → backend/main.py

[主 Agent] 验收前端 ✓
[主 Agent] 验收后端 → 发现测试失败           ← 验收机制
[sub-agent: Debugger] 启动 (独立上下文)      ← reject + retry
  context 包含：失败报告 + 根因分析 + 修改建议
[sub-agent: Debugger] 完成 → backend/main.py (修复版)
[主 Agent] 验收后端 ✓

[sub-agent: 报告撰写] 完成 → delivery_report.md

========== 交付完成 ==========
```

在日志旁用简短注释标注三个核心机制（上下文隔离、并发执行、验收机制）的体现位置。

讲解要点：
- 串行阶段（架构→接口→Mock）：有依赖关系，必须按顺序
- 并发阶段（前端+后端）：互不依赖，同时执行
- 验收+重试：发现问题后分析根因，带上下文 spawn Debugger

- [ ] **Step 5: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git commit -m "feat: add section 3 - code practice with CrewAI"
```

---

### Task 7: 绘制图3——代码实战全流程（可选）

**Files:**
- Create: `source/_posts/ai-agent-orchestrator/flow.svg`
- Create: `source/_posts/ai-agent-orchestrator/flow.png`

**参考：** PDF 第6页全流程图。

- [ ] **Step 1: 编写 flow.svg**

SVG 宽 880，展示 Orchestrator 调度全流程：

布局：从左到右，分为四个区域：

**输入区（左）：**
- requirements.md 文档节点

**主代理（中左）：**
- 主 Agent Orchestrator 节点（大，`#4361ee` 填充）
- 标注「10年技术负责人」

**执行区（中右）：**
- 阶段标注：「阶段1-2：串行」
  - 架构设计师 → api_spec → Mock 工程师（串行链）
- 阶段标注：「阶段3：并发」
  - 前端 Developer 和后端 Developer 并排
  - 标注「互不感知对方上下文」

**验收区（右）：**
- 主 Agent 验收节点
- 菱形判断（ACCEPT/REJECT）
- REJECT → 回到执行区（Debugger）
- ACCEPT → delivery_report.md

SVG 遵循 draw-diagram skill 规范。

- [ ] **Step 2: 渲染 PNG**

```bash
cd ~/ayou/blog/source/_posts/ai-agent-orchestrator
node render.mjs flow.svg
```

- [ ] **Step 3: 验证图片**

用 Read 工具检查。如有问题修改后重新渲染。

- [ ] **Step 4: 在文章第三节适当位置插入图片引用**

在第三节开头或 3.4 运行效果之前插入 `![](flow.png)`。

- [ ] **Step 5: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator/flow.png source/_posts/ai-agent-orchestrator/flow.svg source/_posts/ai-agent-orchestrator.md
git commit -m "feat: add orchestrator flow diagram"
```

---

### Task 8: 撰写第四节和第五节 + 清理临时文件

**Files:**
- Modify: `source/_posts/ai-agent-orchestrator.md`
- Delete: `source/_posts/ai-agent-orchestrator/*.svg`
- Delete: `source/_posts/ai-agent-orchestrator/render.mjs`

- [ ] **Step 1: 追加第四节——最佳实践与反模式**

章节标题：`## 四、最佳实践与反模式`

内容约 500 字，分两部分：

**反模式（别做）：**
1. 无 kill switch：无预算上限+无终止条件，HN 案例 $600 账单零产出
2. 规划错误放大：主 Agent 规划出错，子 Agent 全在错误前提下执行
3. 并行写冲突：共享规范没定好就并发，产物无法调和
4. 平铺无层级：Google DeepMind 研究，平铺 Agent 误差 17 倍放大

**最佳实践（该做）：**
1. 先跑单 Agent，有需求再扩
2. 执行和评审分离
3. 每步可靠性 ≥99%：可靠性指数衰减（0.95^10 ≈ 0.60）
4. 显式传递上下文：Anthropic 案例——三个子 Agent 重复调查同一个 bug

**写作注意：**
- 不要用表格堆砌，用段落叙述
- 每条反模式/实践都给出具体的来源或案例
- 语气要实在，"别做 X"而不是"应避免 X"

- [ ] **Step 2: 追加第五节——总结**

章节标题：`## 五、总结`

内容约 200 字：
- 一句话总结 Orchestrator：主 Agent（拆解+调度+验收）+ N * 子 Agent（独立执行），通过文件路径传递结果
- 回扣系列主线：前六篇让一个 Agent 越来越强，这篇开始让多个 Agent 协作
- 适用场景判断：任务能自然分解 + 有并发收益 → Orchestrator；否则单 Agent 就够

- [ ] **Step 3: 清理临时文件**

```bash
cd ~/ayou/blog/source/_posts/ai-agent-orchestrator
rm -f compare.svg mechanism.svg flow.svg render.mjs
```

- [ ] **Step 4: Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git add -u source/_posts/ai-agent-orchestrator/
git commit -m "feat: add sections 4-5 and clean up temp files"
```

---

### Task 9: 文章自检 + 最终提交

**Files:**
- Modify: `source/_posts/ai-agent-orchestrator.md`

- [ ] **Step 1: write-tech-article 去 AI 味自检**

逐条检查：
1. 连续三个句子长度相同？打断其中一个
2. 段落结尾都是总结句？变换结尾方式
3. 用了「此外」「然而」等连接词？删除
4. 三项并列？改为两项或四项
5. 结尾像「展望未来」？改成具体事实或建议
6. AI 高频词汇（此外、至关重要、深入探讨、增强、培养、格局、关键性的、展示、证明、充满活力的、宝贵的、不断演变的）？替换
7. 否定式排比（「这不仅仅是 X，而是 Y」）？直接说 Y
8. 破折号每段最多一个？
9. 粗体只用于关键术语首次出现？

- [ ] **Step 2: 内容规范自检**

1. 每个代码块都有语言标识符？
2. 图片用本地相对路径 `./ai-agent-orchestrator/N.png`？
3. 新概念引入有铺垫？不会突然蹦出一个没见过的名词？
4. 章节顺序符合依赖关系？
5. 段落之间有自然衔接？
6. frontmatter 包含 description 字段？

- [ ] **Step 3: 通读全文，修正发现的问题**

通读一遍，修正任何不通顺的地方。

- [ ] **Step 4: 最终 Commit**

```bash
cd ~/ayou/blog
git add source/_posts/ai-agent-orchestrator.md
git commit -m "docs: polish orchestrator article after self-review"
```
