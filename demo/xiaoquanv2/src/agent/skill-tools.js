import {tool} from 'ai'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'

const SKILLS_DIR = path.resolve('skills')

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return {data: {}, body: raw.trim()}
  const data = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    data[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim()
  }
  return {data, body: match[2].trim()}
}

export function loadSkillRegistry(skillsDir = SKILLS_DIR) {
  const registry = {}
  if (!fs.existsSync(skillsDir)) return registry

  const dirs = fs.readdirSync(skillsDir, {withFileTypes: true})
    .filter(d => d.isDirectory())
  for (const dir of dirs) {
    const skillFile = path.join(skillsDir, dir.name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue
    const raw = fs.readFileSync(skillFile, 'utf-8')
    const {data, body} = parseFrontmatter(raw)
    registry[data.name || dir.name] = {
      name: data.name || dir.name,
      type: data.type || 'reference',
      description: (data.description || '').slice(0, 200),
      prompt: body,
      dir: path.join(skillsDir, dir.name),
    }
  }
  return registry
}

export function createSkillTools(registry, {sessionId, historyAll = []} = {}) {
  return {
    list_skills: tool({
      description: '列出所有可用的 Skill（专项能力）及其简要描述',
      parameters: z.object({}),
      execute: async () => {
        const list = Object.values(registry).map(s => ({
          name: s.name,
          type: s.type,
          description: s.description,
        }))
        return JSON.stringify(list, null, 2)
      },
    }),

    get_skill: tool({
      description: '获取指定 Skill 的详细行为指令。在执行相关任务前应先调用此工具。',
      parameters: z.object({
        name: z.string().describe('Skill 名称'),
      }),
      execute: async ({name}) => {
        const skill = registry[name]
        if (!skill) return `未找到名为 "${name}" 的 Skill`
        let prompt = skill.prompt
        if (sessionId) {
          prompt = prompt.replace(/\{session_id\}/g, sessionId)
          prompt = prompt.replace(/\{session_dir\}/g, `data/workspace/sessions/${sessionId}`)
        }
        return prompt
      },
    }),
  }
}
