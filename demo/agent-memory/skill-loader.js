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
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(skillsDir, file), 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    return { name: data.name, description: data.description, prompt: body, file }
  })
}
