import fs from 'fs'
import path from 'path'
import { tool } from 'ai'
import { z } from 'zod'
import { execSync } from 'child_process'

// Skills reference — set by index.js at startup
let _skills = []

export function setSkills(skills) {
  _skills = skills
}

export const tools = {
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
        const dir = path.dirname(filePath)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(filePath, content)
        return `已写入 ${filePath}`
      } catch (e) {
        return `写入失败: ${e.message}`
      }
    },
  }),

  load_skill: tool({
    description: '按名称加载一个 Skill 的完整执行指令。可用 Skill：\n' +
      '调用前先看看可用列表，选择最匹配用户意图的 Skill。',
    parameters: z.object({
      name: z.string().describe('要加载的 Skill 名称'),
    }),
    execute: async ({ name }) => {
      const skill = _skills.find(s => s.name === name)
      if (!skill) return `未找到名为 "${name}" 的 Skill。可用：${_skills.map(s => s.name).join('、')}`
      return skill.prompt
    },
  }),
}
