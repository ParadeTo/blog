import fs from 'fs'
import path from 'path'
import { tool } from 'ai'
import { z } from 'zod'
import { execSync } from 'child_process'
import { storeMemory } from './memory-store.js'
import { searchMemory } from './memory-search.js'

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

  memory_store: tool({
    description: '将一轮对话存入长期记忆。在对话包含值得记住的信息时调用。',
    parameters: z.object({
      session_id: z.string().describe('当前会话 ID'),
      routing_key: z.string().describe('用户标识，如 p2p:user_name'),
      user_message: z.string().describe('用户的原始消息'),
      assistant_reply: z.string().describe('助手的回复'),
      summary: z.string().describe('这轮对话的一句话摘要'),
      tags: z.array(z.string()).describe('领域标签，如 ["travel","flight"]'),
    }),
    execute: async ({ session_id, routing_key, user_message, assistant_reply, summary, tags }) => {
      try {
        const id = await storeMemory({
          sessionId: session_id,
          routingKey: routing_key,
          userMessage: user_message,
          assistantReply: assistant_reply,
          summary,
          tags,
          turnTs: Date.now(),
        })
        return `已存入长期记忆，id: ${id}`
      } catch (e) {
        return `存储失败: ${e.message}`
      }
    },
  }),

  memory_search: tool({
    description: '从长期记忆中检索历史对话。当用户提到"上次"、"之前"或需要历史上下文时使用。',
    parameters: z.object({
      query: z.string().describe('搜索查询，描述要找什么'),
      routing_key: z.string().describe('用户标识'),
      top_k: z.number().optional().default(5).describe('返回条数，默认 5'),
      tags: z.array(z.string()).optional().describe('按标签过滤'),
      after_date: z.string().optional().describe('只搜索此日期之后的记忆，ISO 格式'),
    }),
    execute: async ({ query: queryText, routing_key, top_k, tags, after_date }) => {
      try {
        const results = await searchMemory({
          queryText,
          routingKey: routing_key,
          topK: top_k || 5,
          tags: tags?.length ? tags : null,
          afterDate: after_date || null,
        })
        if (results.length === 0) return '未找到相关记忆'
        return JSON.stringify(
          results.map(r => ({
            summary: r.summary,
            user_message: r.user_message,
            assistant_reply: r.assistant_reply,
            tags: r.tags,
            score: Math.round(r.score * 1000) / 1000,
            created_at: r.created_at,
          })),
          null,
          2
        )
      } catch (e) {
        return `检索失败: ${e.message}`
      }
    },
  }),
}
