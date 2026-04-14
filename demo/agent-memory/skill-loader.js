import fs from 'fs'
import path from 'path'

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

export function loadSkills(skillsDir) {
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  const skills = []

  for (const entry of entries) {
    let filePath
    if (entry.isFile() && entry.name.endsWith('.md')) {
      // 单文件 skill: skills/memory-save.md
      filePath = path.join(skillsDir, entry.name)
    } else if (entry.isDirectory()) {
      // 目录 skill: skills/standup-message/SKILL.md
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md')
      if (fs.existsSync(skillMd)) filePath = skillMd
    }
    if (!filePath) continue

    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    skills.push({ name: data.name, description: data.description, prompt: body, file: path.relative(skillsDir, filePath) })
  }

  return skills
}
