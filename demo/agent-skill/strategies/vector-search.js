/**
 * 方案一：向量语义检索
 *
 * 用 embedding 模型将 Skill description 和用户输入向量化，
 * 通过余弦相似度找最匹配的 Skill。
 * Skill 检测阶段无需 LLM 调用，只需一次 embedding 请求。
 *
 * 优点：检测延迟低，Skill 数量多时也能快速匹配
 * 缺点：泛化能力取决于 embedding 模型质量
 * 适用：Skill 数量多、延迟敏感的场景
 */
import { embed, embedMany, cosineSimilarity } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { executeWithSkill } from '../utils.js'

const openai = createOpenAI({
  baseURL: 'http://localhost:3001',
  apiKey: process.env.ANTHROPIC_API_KEY ?? 'no-key',
})

const embeddingModel = openai.embedding('text-embedding-3-small')

// 缓存 Skill 的 embedding，启动时只算一次
let skillEmbeddings = null

async function initEmbeddings(skills) {
  if (skillEmbeddings) return
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: skills.map(s => `${s.name}: ${s.description}`),
  })
  skillEmbeddings = embeddings
}

async function detectSkill(userInput, skills, threshold = 0.4) {
  await initEmbeddings(skills)

  const { embedding: inputEmbedding } = await embed({
    model: embeddingModel,
    value: userInput,
  })

  const scores = skills.map((s, i) => ({
    skill: s,
    score: cosineSimilarity(inputEmbedding, skillEmbeddings[i]),
  }))
  scores.sort((a, b) => b.score - a.score)

  const best = scores[0]
  const second = scores[1]

  console.log(`  [向量] 最高分：${best.score.toFixed(3)}（${best.skill.name}）`)

  // 最高分低于阈值，不匹配
  if (best.score < threshold) return null
  // 最高分和次高分差距太小，无法确定匹配
  if (second && best.score - second.score < 0.05) return null

  return best.skill
}

export async function chat(messages, skills) {
  const lastUserMsg = messages.findLast(m => m.role === 'user')?.content ?? ''
  const skill = await detectSkill(lastUserMsg, skills)
  return executeWithSkill(messages, skill)
}
