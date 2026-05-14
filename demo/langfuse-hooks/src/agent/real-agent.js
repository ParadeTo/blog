import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

const WORKSPACE_FILES = ['soul.md', 'agent.md', 'user.md', 'memory.md']
const DEFAULT_MODEL = 'gpt-5.4-nano-2026-03-17'
const DEFAULT_BASE_URL = 'http://localhost:3002/v1'
const MAX_TURNS = 6

function splitFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return { data: {}, body: markdown }
  }

  const end = markdown.indexOf('\n---\n', 4)
  if (end === -1) return { data: {}, body: markdown }

  const raw = markdown.slice(4, end)
  const body = markdown.slice(end + 5)
  return {
    data: YAML.parse(raw) ?? {},
    body,
  }
}

function compactText(value, limit = 4000) {
  const text = String(value ?? '')
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}... [truncated, ${text.length} chars total]`
}

function chatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  if (normalized.endsWith('/chat/completions')) return normalized
  return `${normalized}/chat/completions`
}

function parseToolArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function outputRelativePath(filePath) {
  return path.relative(process.cwd(), filePath)
}

function resolveOutputPath(workspaceDir, requestedPath = 'workspace/demo_agent/output/design_doc.md') {
  const outputDir = path.join(workspaceDir, 'output')
  const fallback = path.join(outputDir, 'design_doc.md')
  const candidate = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(process.cwd(), requestedPath)
  const relative = path.relative(outputDir, candidate)

  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return candidate
  }

  if (path.basename(requestedPath) === 'design_doc.md') {
    return fallback
  }

  throw new Error(`write_file path must be inside ${outputRelativePath(outputDir)}`)
}

function normalizeResult(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  const text = String(value).trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text

  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

export function resolveLlmConfig(env = process.env) {
  return {
    apiKey: env.LANGFUSE_HOOKS_OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || '',
    baseUrl: env.LANGFUSE_HOOKS_OPENAI_API_BASE || DEFAULT_BASE_URL,
    model: env.LANGFUSE_HOOKS_AGENT_MODEL || DEFAULT_MODEL,
  }
}

export async function openAiCompatibleChat({ apiKey, baseUrl, body }) {
  if (!apiKey) {
    throw new Error('missing OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }

  const response = await fetch(chatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || text || response.statusText
    throw new Error(`LLM request failed (${response.status}): ${message}`)
  }

  return payload
}

export async function buildBootstrapPrompt(workspaceDir) {
  const parts = []

  for (const fileName of WORKSPACE_FILES) {
    const filePath = path.join(workspaceDir, fileName)
    const content = await fs.readFile(filePath, 'utf8')
    parts.push(`<${fileName}>\n${content.trim()}\n</${fileName}>`)
  }

  return parts.join('\n\n')
}

export async function loadSkillRegistry(skillsDir) {
  const configPath = path.join(skillsDir, 'load_skills.yaml')
  const config = YAML.parse(await fs.readFile(configPath, 'utf8')) ?? {}
  const skills = new Map()

  for (const entry of config.skills ?? []) {
    if (!entry.enabled) continue

    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
    const raw = await fs.readFile(skillPath, 'utf8')
    const { data, body } = splitFrontmatter(raw)

    skills.set(entry.name, {
      name: data.name ?? entry.name,
      type: data.type ?? entry.type ?? 'task',
      description: data.description ?? '',
      body: body.trim(),
      path: skillPath,
    })
  }

  return skills
}

function buildSystemPrompt({ backstory, skills }) {
  const skillList = [...skills.values()].map(skill => ({
    name: skill.name,
    type: skill.type,
    description: skill.description,
  }))

  return [
    '你是一个会按 SOP 产出技术设计文档的数字员工。',
    '',
    '工作规则：',
    '1. 第一轮必须调用 skill_loader，读取 sop_design 的完整说明。',
    '2. 读取 SOP 后，必须调用 write_file，把完整 Markdown 设计文档写入 workspace/demo_agent/output/design_doc.md。',
    '3. write_file 的 content 必须是完整 Markdown，不要只写摘要。',
    '4. 文件写完后，最终回答只返回 JSON：{"errcode":0,"errmsg":"success","file_path":"workspace/demo_agent/output/design_doc.md"}。',
    '',
    '可用 Skill：',
    JSON.stringify(skillList, null, 2),
    '',
    'Workspace 背景：',
    backstory,
  ].join('\n')
}

function tools() {
  return [
    {
      type: 'function',
      function: {
        name: 'skill_loader',
        description: '按名称加载 Skill 的完整说明。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            skill_name: {
              type: 'string',
              description: '要加载的 Skill 名称，例如 sop_design。',
            },
          },
          required: ['skill_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: '把完整内容写入 workspace/demo_agent/output/ 下的文件。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: {
              type: 'string',
              description: '输出文件路径，必须是 workspace/demo_agent/output/design_doc.md。',
            },
            content: {
              type: 'string',
              description: '要写入的完整 Markdown 内容。',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
  ]
}

async function runTool(adapter, { toolName, toolInput, fn }) {
  const start = performance.now()
  await adapter.beforeToolCall({ toolName, toolInput })

  try {
    const result = await fn()
    await adapter.afterToolCall({
      toolName,
      toolInput,
      toolOutput: JSON.stringify(result),
      durationMs: Math.round(performance.now() - start),
      success: true,
    })
    return result
  } catch (error) {
    await adapter.afterToolCall({
      toolName,
      toolInput,
      toolOutput: error.message,
      durationMs: Math.round(performance.now() - start),
      success: false,
    })
    throw error
  }
}

async function executeTool({ adapter, workspaceDir, skills, toolCall }) {
  const toolName = toolCall.function?.name || toolCall.name
  const args = parseToolArgs(toolCall.function?.arguments || toolCall.arguments)

  if (toolName === 'skill_loader') {
    const skillName = args.skill_name || args.name || 'sop_design'
    return runTool(adapter, {
      toolName,
      toolInput: { skill_name: skillName },
      fn: async () => {
        const skill = skills.get(skillName)
        if (!skill) throw new Error(`skill not found: ${skillName}`)

        return {
          name: skill.name,
          type: skill.type,
          description: skill.description,
          instructions: skill.body,
        }
      },
    })
  }

  if (toolName === 'write_file') {
    return runTool(adapter, {
      toolName,
      toolInput: {
        path: args.path,
        bytes: Buffer.byteLength(String(args.content ?? ''), 'utf8'),
      },
      fn: async () => {
        const target = resolveOutputPath(workspaceDir, args.path)
        const content = String(args.content ?? '').trim()
        if (!content) throw new Error('write_file content is empty')

        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, `${content}\n`, 'utf8')

        return {
          errcode: 0,
          errmsg: 'success',
          file_path: outputRelativePath(target),
        }
      },
    })
  }

  throw new Error(`unknown tool: ${toolName}`)
}

function toolResultMessage(toolCall, result) {
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.function?.name || toolCall.name,
    content: JSON.stringify(result),
  }
}

function assistantMessageForHistory(message) {
  const entry = {
    role: 'assistant',
    content: message.content ?? '',
  }

  if (message.tool_calls?.length) {
    entry.tool_calls = message.tool_calls
  }

  return entry
}

export async function runRealAgent({
  adapter,
  workspaceDir,
  taskDesc,
  backstory,
  skills,
  chatClient = openAiCompatibleChat,
  llmConfig = resolveLlmConfig(),
} = {}) {
  const agentId = '数字员工'
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt({ backstory, skills }),
    },
    {
      role: 'user',
      content: `用户请求：${taskDesc}`,
    },
  ]
  let writeResult = null
  let finalText = ''

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    await adapter.beforeLlm({
      agentId,
      taskDescription: taskDesc,
      messages,
      llm: { model: llmConfig.model },
    })

    const response = await chatClient({
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      body: {
        model: llmConfig.model,
        messages,
        tools: tools(),
        tool_choice: 'auto',
        temperature: 0.2,
      },
    })
    const choice = response.choices?.[0] ?? {}
    const message = choice.message ?? {}
    const usage = response.usage ?? {}
    const toolCalls = message.tool_calls ?? []
    const toolOutputs = []

    if (toolCalls.length > 0) {
      messages.push(assistantMessageForHistory(message))

      for (const toolCall of toolCalls) {
        const result = await executeTool({ adapter, workspaceDir, skills, toolCall })
        toolOutputs.push(result)
        if ((toolCall.function?.name || toolCall.name) === 'write_file') {
          writeResult = result
        }
        messages.push(toolResultMessage(toolCall, result))
      }

      await adapter.afterTurn({
        agentId,
        toolName: toolCalls.map(call => call.function?.name || call.name).join(','),
        llmResponse: compactText(message.content || JSON.stringify(toolCalls)),
        output: compactText(JSON.stringify(toolOutputs)),
        inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
      })
      continue
    }

    finalText = String(message.content ?? '')
    messages.push({ role: 'assistant', content: finalText })
    await adapter.afterTurn({
      agentId,
      llmResponse: compactText(finalText),
      output: compactText(finalText),
      inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    })

    if (writeResult) break

    messages.push({
      role: 'user',
      content: '还没有写入文件。请现在调用 write_file，路径必须是 workspace/demo_agent/output/design_doc.md。',
    })
  }

  if (!writeResult) {
    throw new Error('agent finished without calling write_file')
  }

  const result = normalizeResult(finalText) || writeResult
  await adapter.taskComplete({
    rawOutput: JSON.stringify(result),
    description: taskDesc,
  })

  return {
    result,
    designDocPath: path.resolve(process.cwd(), writeResult.file_path),
  }
}
