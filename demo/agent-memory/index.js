import readline from 'readline'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { generateText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { execSync } from 'child_process'
import { bootstrap } from './bootstrap.js'
import { prune } from './prune.js'
import { compress } from './compress.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_PATH = path.join(__dirname, 'workspace')

const anthropic = createAnthropic({
  baseURL: 'http://localhost:3002',
  apiKey: process.env.ANTHROPIC_API_KEY,
})
const model = anthropic('claude-sonnet-4-6')

const TOKEN_THRESHOLD = 6000
const MAX_ITERATIONS = 10

// ── 工具定义 ─────────────────────────────────────────────────────────────────
const tools = {
  bash: tool({
    description: '执行 shell 命令，返回 stdout',
    parameters: z.object({
      command: z.string().describe('要执行的 shell 命令'),
    }),
    execute: async ({ command }) => {
      try {
        return execSync(command, { encoding: 'utf-8', timeout: 10000 }).trim()
      } catch (e) {
        return `执行失败: ${e.message}`
      }
    },
  }),

  read_file: tool({
    description: '读取指定路径的文件内容',
    parameters: z.object({
      path: z.string().describe('文件路径'),
    }),
    execute: async ({ path: filePath }) => {
      try {
        return fs.readFileSync(filePath, 'utf-8')
      } catch (e) {
        return `读取失败: ${e.message}`
      }
    },
  }),

  write_file: tool({
    description: '将内容写入指定路径的文件',
    parameters: z.object({
      path: z.string().describe('文件路径'),
      content: z.string().describe('要写入的内容'),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, content)
        return `已写入 ${filePath}`
      } catch (e) {
        return `写入失败: ${e.message}`
      }
    },
  }),
}

// ── ReAct 循环 ───────────────────────────────────────────────────────────────
let lastPromptTokens = 0

async function chat(messages, systemPrompt) {
  // 1. 先剪枝：无成本的字符串截断，立即缩减 token
  const pruned = prune(messages)
  messages.length = 0
  messages.push(...pruned)

  // 2. 再压缩：剪枝后仍超阈值才触发（需要 LLM 调用）
  if (lastPromptTokens > TOKEN_THRESHOLD) {
    const before = lastPromptTokens
    const compressed = await compress(messages, {
      keepRecent: 2,
      model,
      workspacePath: WORKSPACE_PATH,
    })
    messages.length = 0
    messages.push(...compressed)
    console.log(`  [Compress] ${before} → (compressed, awaiting next LLM call)`)
    lastPromptTokens = 0
  }

  for (let i = 1; i <= MAX_ITERATIONS; i++) {

    const { steps, text, response, usage } = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 1,
    })

    // 记录本次 prompt token 数
    if (usage) {
      lastPromptTokens = usage.promptTokens
    }

    const step = steps[0]
    if (!step) return text

    if (step.toolCalls.length === 0) {
      return step.text
    }

    for (const tc of step.toolCalls) {
      const result = step.toolResults.find(
        r => r.toolCallId === tc.toolCallId
      )
      console.log(
        `  [Step ${i}] Tool: ${tc.toolName}(${JSON.stringify(tc.args)})`
      )
      if (result) {
        const preview = String(result.result).slice(0, 120)
        console.log(
          `           Result: ${preview}${String(result.result).length > 120 ? '...' : ''}`
        )
      }
    }

    messages.push(...response.messages)
  }

  return '（达到最大迭代次数）'
}

// ── REPL ─────────────────────────────────────────────────────────────────────
async function main() {
  const systemPrompt = bootstrap(WORKSPACE_PATH)
  console.log('=== 小橙 · 个人助理 Agent ===')
  console.log('演示上下文管理：Bootstrap + 剪枝 + 压缩')
  console.log(`[Bootstrap] System prompt loaded`)
  console.log(`[Config] Token threshold: ${TOKEN_THRESHOLD}`)
  console.log('输入 exit 退出\n')

  const messages = []
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = () => {
    const tokenInfo = lastPromptTokens > 0 ? lastPromptTokens : '—'
    rl.question(`[Tokens: ${tokenInfo} / ${TOKEN_THRESHOLD}] You: `, async input => {
      if (input.trim() === 'exit') return rl.close()

      messages.push({ role: 'user', content: input.trim() })

      try {
        const reply = await chat(messages, systemPrompt)
        messages.push({ role: 'assistant', content: reply })
        console.log(`\nAgent: ${reply}\n`)
      } catch (e) {
        console.error(`\nError: ${e.message}\n`)
      }

      ask()
    })
  }

  ask()
}

main()
