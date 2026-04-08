import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { loadSkills } from './utils.js'
import { chat as allInOne }     from './strategies/all-in-one.js'
import { chat as vectorSearch } from './strategies/vector-search.js'
import { chat as intentDetect } from './strategies/intent-detect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const strategies = {
  'all-in-one': allInOne,
  'vector':     vectorSearch,
  'intent':     intentDetect,
}

const STRATEGY = process.env.STRATEGY ?? 'intent'
const chat = strategies[STRATEGY]

if (!chat) {
  console.error(`未知策略：${STRATEGY}，可用：${Object.keys(strategies).join(' | ')}`)
  process.exit(1)
}

async function main() {
  const skillsDir = path.join(__dirname, 'skills')
  const skills = loadSkills(skillsDir)

  console.log(`策略：${STRATEGY}`)
  console.log(`已加载 ${skills.length} 个 Skill：${skills.map(s => s.name).join('、')}`)
  console.log('输入 exit 退出\n')

  const messages = []
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = () =>
    rl.question('You: ', async input => {
      if (input.trim() === 'exit') return rl.close()
      messages.push({ role: 'user', content: input.trim() })
      const reply = await chat(messages, skills)
      messages.push({ role: 'assistant', content: reply })
      console.log(`\nAgent: ${reply}\n`)
      ask()
    })

  ask()
}

main()
