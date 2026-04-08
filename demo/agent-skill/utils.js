import { generateText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export const anthropic = createAnthropic({
  baseURL: 'http://localhost:3001',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── 解析 Skill 文件（frontmatter + 正文）─────────────────────────────────────
export function parseFrontmatter(raw) {
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

// ── 从 skills/ 目录加载所有 Skill ────────────────────────────────────────────
export function loadSkills(skillsDir) {
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(skillsDir, file), 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    return { name: data.name, description: data.description, prompt: body }
  })
}

// ── Agent 可用的工具 ────────────────────────────────────────────────────────
const agentTools = {
  read_file: tool({
    description: '读取指定路径的文件内容',
    parameters: z.object({
      path: z.string().describe('文件路径'),
    }),
    execute: async ({ path: filePath }) => {
      return fs.readFileSync(filePath, 'utf-8')
    },
  }),
  run_script: tool({
    description: '执行指定路径的脚本文件，返回执行结果',
    parameters: z.object({
      path: z.string().describe('脚本文件路径'),
      args: z.string().optional().describe('传给脚本的参数'),
    }),
    execute: async ({ path: scriptPath, args }) => {
      const cmd = args ? `node ${scriptPath} ${args}` : `node ${scriptPath}`
      return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
    },
  }),
}

// ── 带 Skill 执行主 LLM（三种策略共用）──────────────────────────────────────
export async function executeWithSkill(messages, skill) {
  if (skill) console.log(`\n[触发 Skill: ${skill.name}]\n`)

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: skill?.prompt ?? '你是一个智能助手，请帮助用户解决问题。',
    messages,
    tools: agentTools,
    maxSteps: 5,
  })
  return text
}
