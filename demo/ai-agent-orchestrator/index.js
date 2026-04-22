import { generateText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.join(__dirname, 'workspace')

const anthropic = createAnthropic({
  baseURL: 'http://localhost:3002',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── 基础工具 ─────────────────────────────────────────────────────────────────

const writeFile = tool({
  description: '将内容写入指定文件，自动创建目录',
  parameters: z.object({
    filePath: z.string().describe('文件路径（相对于 workspace）'),
    content: z.string().describe('文件内容'),
  }),
  execute: async ({ filePath, content }) => {
    const abs = path.resolve(WORKSPACE, filePath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf-8')
    return `已写入 ${filePath}（${content.length} 字符）`
  },
})

const readFile = tool({
  description: '读取指定文件的内容',
  parameters: z.object({
    filePath: z.string().describe('文件路径（相对于 workspace）'),
  }),
  execute: async ({ filePath }) => {
    const abs = path.resolve(WORKSPACE, filePath)
    try {
      return fs.readFileSync(abs, 'utf-8')
    } catch (e) {
      return `读取失败: ${e.message}`
    }
  },
})

const runCommand = tool({
  description: '执行 shell 命令',
  parameters: z.object({
    command: z.string().describe('要执行的命令'),
  }),
  execute: async ({ command }) => {
    try {
      return execSync(command, {
        cwd: WORKSPACE,
        encoding: 'utf-8',
        timeout: 30000,
      }).trim()
    } catch (e) {
      return `执行失败: ${e.message}`
    }
  },
})

// ── 子 Agent 运行器 ──────────────────────────────────────────────────────────

async function runSubAgent({ role, goal, task, context, tools, outputFile }) {
  console.log(`  [sub-agent: ${role}] 启动 (独立上下文)`)

  try {
    await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: `你是${role}。\n目标：${goal}\n\n背景信息：\n${context}`,
      prompt: `${task}\n\n请使用 writeFile 工具将最终结果写入文件 ${outputFile}，需要同时提供 filePath 和 content 两个参数。`,
      tools,
      maxSteps: 15,
      maxTokens: 16384,
    })

    console.log(`  [sub-agent: ${role}] 完成 → ${outputFile}`)
    return { status: 'done', file: outputFile }
  } catch (e) {
    console.log(`  [sub-agent: ${role}] 失败: ${e.message}`)
    return { status: 'error', file: outputFile, error: e.message }
  }
}

// ── 编排工具 ─────────────────────────────────────────────────────────────────

const spawnSubAgent = tool({
  description: '创建一个子 Agent 执行任务（串行，等完成再返回）',
  parameters: z.object({
    role: z.string().describe('子 Agent 角色'),
    goal: z.string().describe('一句话目标'),
    task: z.string().describe('详细任务描述'),
    context: z.string().describe('子 Agent 需要的完整上下文'),
    outputFile: z.string().describe('结果输出文件路径'),
  }),
  execute: async ({ role, goal, task, context, outputFile }) => {
    return await runSubAgent({
      role, goal, task, context, outputFile,
      tools: { writeFile, readFile },
    })
  },
})

const spawnParallel = tool({
  description: '并发启动多个独立子 Agent',
  parameters: z.object({
    subtasks: z.array(z.object({
      role: z.string(),
      goal: z.string(),
      task: z.string(),
      context: z.string(),
      outputFile: z.string(),
    })),
  }),
  execute: async ({ subtasks }) => {
    console.log(`  [并发启动] ${subtasks.length} 个子 Agent 同时运行...`)
    const results = await Promise.allSettled(
      subtasks.map(st =>
        runSubAgent({ ...st, tools: { writeFile, readFile } })
      )
    )
    return results.map((r, i) => ({
      file: subtasks[i].outputFile,
      ...(r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) }),
    }))
  },
})

// ── 主 Agent（Orchestrator）────────────────────────────────────────────────

async function runOrchestrator(requirementPath) {
  const sop = fs.readFileSync(path.join(__dirname, 'skills/dev-sop.md'), 'utf-8')
  const requirement = fs.readFileSync(requirementPath, 'utf-8')

  console.log('========== Orchestrator 启动 ==========')
  console.log(`[主 Agent] 读取 ${requirementPath}...\n`)

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: `你是一名有 10 年全栈经验的技术负责人。

你的工作方式：
1. 架构、代码、文档一律由子 Agent 产出——你只负责派单和验收
2. 给子 Agent 派任务时，把它需要的信息全部传进 context，不要假设它知道任何背景
3. 没有依赖关系的任务用 spawnParallel 并发；有依赖的用 spawnSubAgent 串行
4. 子 Agent 完成后，用 readFile 读取产出文件做验收
5. 验收不通过时，先分析根因，再带着分析结果 spawn 新的子 Agent 修复

━━━ SOP 流程 ━━━
${sop}`,
    prompt: `请处理以下需求，按 SOP 完成交付：\n\n${requirement}`,
    tools: { spawnSubAgent, spawnParallel, readFile },
    maxSteps: 50,
    maxTokens: 16384,
  })

  console.log('\n========== 交付完成 ==========')
  return text
}

// ── 入口 ─────────────────────────────────────────────────────────────────────

const reqPath = process.argv[2] || path.join(WORKSPACE, 'requirements.md')
runOrchestrator(reqPath).then(result => {
  console.log('\n[Orchestrator 最终输出]\n', result)
}).catch(err => {
  console.error('Orchestrator 执行失败:', err.message)
  process.exit(1)
})
