import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { bootstrap } from './bootstrap.js'
import { prune } from './prune.js'
import { compress } from './compress.js'
import { loadSkills } from './skill-loader.js'
import { tools, setSkills } from './tools.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.chdir(__dirname) // 确保相对路径（workspace/、skills/）始终正确
const WORKSPACE_PATH = path.join(__dirname, 'workspace')
const SKILLS_PATH = path.join(__dirname, 'skills')

const anthropic = createAnthropic({
  baseURL: 'http://localhost:3002',
  apiKey: process.env.ANTHROPIC_API_KEY,
})
const model = anthropic('claude-sonnet-4-6')

const TOKEN_THRESHOLD = 6000
const MAX_ITERATIONS = 10

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
  // 1. 加载 skills
  const skills = loadSkills(SKILLS_PATH)
  setSkills(skills)

  // 2. 构建 system prompt = bootstrap + skill 列表
  const basePrompt = bootstrap(WORKSPACE_PATH)
  const skillList = skills
    .map(s => `- ${s.name}: ${s.description}`)
    .join('\n')
  const systemPrompt = `${basePrompt}

<available_skills>
以下是你可以按需加载的 Skill。当用户的请求匹配某个 Skill 的描述时，用 load_skill 工具加载它，然后按照返回的指令执行。

${skillList}
</available_skills>`

  console.log('=== 小橙 · 个人助理 Agent ===')
  console.log('演示上下文管理 + 文件系统记忆')
  console.log(`[Bootstrap] System prompt loaded`)
  console.log(`[Skills] 已加载 ${skills.length} 个: ${skills.map(s => s.name).join('、')}`)
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
