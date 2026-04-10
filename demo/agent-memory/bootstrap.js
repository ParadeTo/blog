import fs from 'fs'
import path from 'path'

const MAX_CHARS_PER_FILE = 2000

const SECTIONS = [
  { file: 'soul.md', tag: 'soul' },
  { file: 'user.md', tag: 'user_profile' },
  { file: 'agent.md', tag: 'agent' },
  { file: 'memory/MEMORY.md', tag: 'memory_index' },
]

function readWithLimit(filePath, limit) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (content.length <= limit) return content.trim()
    return content.slice(0, limit).trim() + '\n...(truncated)'
  } catch {
    return '(file not found)'
  }
}

export function bootstrap(workspacePath) {
  const parts = SECTIONS.map(({ file, tag }) => {
    const filePath = path.join(workspacePath, file)
    const content = readWithLimit(filePath, MAX_CHARS_PER_FILE)
    return `<${tag}>\n${content}\n</${tag}>`
  })

  return parts.join('\n\n')
}
