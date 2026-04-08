/**
 * 方案三：全量描述 + 主模型判断
 *
 * 把所有 Skill 的 name 和 description（不含完整指令）塞进 system prompt，
 * 由主模型判断匹配哪个 Skill，命中后再加载完整 Skill prompt 执行。
 *
 * 和 intent-detect 的区别：用主模型做检测，不依赖额外的小模型。
 * 因为只传 description 不传完整指令，上下文开销很小。
 *
 * 优点：不需要额外模型，逻辑简单
 * 缺点：检测步骤用主模型，成本比 haiku 高
 * 适用：不想引入多模型、Skill 数量适中的场景
 */
import { generateText } from 'ai'
import { anthropic, executeWithSkill } from '../utils.js'

async function detectSkill(userInput, skills) {
  const skillList = skills.map(s => `- ${s.name}: ${s.description}`).join('\n')

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    maxTokens: 20,
    system: `判断用户输入是否匹配以下某个 skill。
如果匹配，只输出该 skill 的 name；如果都不匹配，只输出 none。
不要输出任何其他内容。

可用 Skill：
${skillList}`,
    prompt: userInput,
  })

  const name = text.trim().toLowerCase()
  return skills.find(s => s.name === name) ?? null
}

export async function chat(messages, skills) {
  const lastUserMsg = messages.findLast(m => m.role === 'user')?.content ?? ''
  const skill = await detectSkill(lastUserMsg, skills)
  return executeWithSkill(messages, skill)
}
