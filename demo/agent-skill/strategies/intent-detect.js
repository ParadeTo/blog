/**
 * 方案三：LLM 意图分类
 *
 * 用一个快速的小模型（claude-haiku）专门做意图分类，
 * 判断用户输入命中哪个 Skill，再由主 LLM 带 Skill 执行。
 *
 * 优点：语义理解能力最强，准确率最高
 * 缺点：多一次 LLM 调用（用小模型把延迟和成本压到很低）
 * 适用：Skill description 语义复杂、需要真正理解意图的场景
 */
import { generateText } from 'ai'
import { anthropic, executeWithSkill } from '../utils.js'

async function detectSkill(userInput, skills) {
  const skillList = skills.map(s => `- ${s.name}: ${s.description}`).join('\n')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5@20251001'),   // 快速小模型，降低延迟和成本
    maxTokens: 20,
    system: `判断用户输入是否匹配以下某个 skill。
如果匹配，只输出该 skill 的 name（如 translate）；如果都不匹配，只输出 none。
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
