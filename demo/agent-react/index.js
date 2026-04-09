import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { execSync } from 'child_process'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const anthropic = createAnthropic({
  baseURL: 'http://localhost:3001',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── 加载 Skill 文件 ─────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { data: {}, body: raw.trim() }
  const data = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    data[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim()
  }
  return { data, body: match[2].trim() }
}

function loadSkills(skillsDir) {
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(skillsDir, file), 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    return { name: data.name, description: data.description, prompt: body }
  })
}

// ── System Prompt（精简，不包含 skill 指令）──────────────────────────────────
const SYSTEM_PROMPT = `你是一个通用智能助手，可以自主使用工具来完成用户的任务。

你拥有一组 Skill（专项能力），但你并不预先知道它们的详细指令。
当你判断任务可能需要某项专项能力时，请先用 list_skills 查看可用 Skill 列表，
再用 get_skill 获取相关 Skill 的详细指令，然后严格按照指令执行。

请根据用户的需求，自主决定每一步该做什么。
如果任务需要多个步骤（例如"查天气并翻译成英文"），请逐步完成，按需获取所需的 Skill 指令。`

// ── 工具定义 ─────────────────────────────────────────────────────────────────
function createTools(skills) {
  return {
    list_skills: tool({
      description: '列出所有可用的 Skill（专项能力）及其简要描述',
      parameters: z.object({}),
      execute: async () => {
        const list = skills.map(s => ({ name: s.name, description: s.description }))
        return JSON.stringify(list)
      },
    }),

    get_skill: tool({
      description: '获取指定 Skill 的详细行为指令，在执行相关任务前应先调用此工具',
      parameters: z.object({
        name: z.string().describe('Skill 名称'),
      }),
      execute: async ({ name }) => {
        const skill = skills.find(s => s.name === name)
        if (!skill) return `未找到名为 "${name}" 的 Skill`
        return skill.prompt
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

    run_script: tool({
      description: '执行指定的 Node.js 脚本文件，返回执行结果',
      parameters: z.object({
        path: z.string().describe('脚本文件路径'),
        args: z.string().optional().describe('传给脚本的参数'),
      }),
      execute: async ({ path: scriptPath, args }) => {
        const cmd = args ? `node ${scriptPath} ${args}` : `node ${scriptPath}`
        try {
          return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
        } catch (e) {
          return `执行失败: ${e.message}`
        }
      },
    }),
  }
}

// ── 显式 ReAct 循环 ─────────────────────────────────────────────────────────
const MAX_ITERATIONS = 10

async function chat(messages, tools) {
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const { steps, text, response } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 1,
    })

    const step = steps[0]
    if (!step) return text

    if (step.toolCalls.length === 0) {
      return step.text
    }

    for (const tc of step.toolCalls) {
      const result = step.toolResults.find(r => r.toolCallId === tc.toolCallId)
      console.log(`  [Step ${i}] Tool: ${tc.toolName}(${JSON.stringify(tc.args)})`)
      if (result) {
        const preview = String(result.result).slice(0, 120)
        console.log(`           Result: ${preview}${String(result.result).length > 120 ? '...' : ''}`)
      }
    }

    messages.push(...response.messages)
  }

  return '（达到最大迭代次数）'
}

// ── REPL ─────────────────────────────────────────────────────────────────────
async function main() {
  const skillsDir = path.join(__dirname, 'skills')
  const skills = loadSkills(skillsDir)
  const tools = createTools(skills)

  console.log('=== ReAct Agent ===')
  console.log('统一 Agent，无 Skill 路由，模型在显式 ReAct 循环中自主决策')
  console.log(`已加载 ${skills.length} 个 Skill：${skills.map(s => s.name).join('、')}`)
  console.log('输入 exit 退出\n')

  const messages = []
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const ask = () =>
    rl.question('You: ', async input => {
      if (input.trim() === 'exit') return rl.close()
      messages.push({ role: 'user', content: input.trim() })
      const reply = await chat(messages, tools)
      messages.push({ role: 'assistant', content: reply })
      console.log(`\nAgent: ${reply}\n`)
      ask()
    })

  ask()
}

main()
