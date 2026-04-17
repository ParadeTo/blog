import {generateText} from 'ai'
import {createAnthropic} from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  baseURL: 'http://localhost:3002',
})
import {createOpenAI} from '@ai-sdk/openai'
import {embed} from 'ai'

let _embeddingModel = null

export function getModel(modelId) {
  return anthropic(modelId || 'claude-sonnet-4-6')
}

export function getEmbeddingModel(modelId) {
  if (_embeddingModel) return _embeddingModel
  const openai = createOpenAI({apiKey: process.env.OPENAI_API_KEY})
  _embeddingModel = openai.embedding(modelId || 'text-embedding-3-small')
  return _embeddingModel
}

export async function chat({model, system, messages, tools, maxSteps = 1}) {
  return generateText({
    model: getModel(model),
    system,
    messages,
    tools,
    maxSteps,
  })
}

export async function embedText(text) {
  const {embedding} = await embed({
    model: getEmbeddingModel(),
    value: text,
  })
  return embedding
}

export async function embedMany(texts) {
  const {embedMany: embedManyFn} = await import('ai')
  const {embeddings} = await embedManyFn({
    model: getEmbeddingModel(),
    values: texts,
  })
  return embeddings
}
