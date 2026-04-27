import {generateText, tool} from 'ai'
import {createAnthropic} from '@ai-sdk/anthropic'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'
import {DockerSandbox} from './sandbox.js'

const anthropic = createAnthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || 'http://localhost:3003',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function loadWorkspaceContext(workspaceDir) {
  const files = ['soul.md', 'agent.md', 'user.md', 'memory.md']
  const parts = []
  for (const file of files) {
    const filePath = path.join(workspaceDir, file)
    if (fs.existsSync(filePath)) {
      parts.push(`## ${file}\n\n${fs.readFileSync(filePath, 'utf-8')}`)
    }
  }
  return parts.join('\n\n---\n\n')
}

export async function createDigitalWorker({workspaceDir, sharedDir, model = 'claude-sonnet-4-6'}) {
  const context = loadWorkspaceContext(workspaceDir)
  const sandbox = new DockerSandbox({workspaceDir, sharedDir})

  const tools = {
    readFile: tool({
      description: '读取文件内容',
      parameters: z.object({
        filePath: z.string().describe('文件的绝对路径'),
      }),
      execute: async ({filePath}) => {
        try {
          return fs.readFileSync(filePath, 'utf-8')
        } catch (e) {
          return `读取失败: ${e.message}`
        }
      },
    }),

    writeFile: tool({
      description: '将内容写入文件（自动创建目录）',
      parameters: z.object({
        filePath: z.string().describe('文件的绝对路径'),
        content: z.string().describe('文件内容'),
      }),
      execute: async ({filePath, content}) => {
        try {
          fs.mkdirSync(path.dirname(filePath), {recursive: true})
          fs.writeFileSync(filePath, content, 'utf-8')
          return `已写入 ${filePath}（${content.length} 字符）`
        } catch (e) {
          return `写入失败: ${e.message}`
        }
      },
    }),

    run_script: tool({
      description: '在 Docker 沙盒中执行脚本（mailbox_cli.js、init_workspace.js 等）。scriptPath 是相对于 workspace/skills/ 的路径，如 "mailbox/scripts/mailbox_cli.js"',
      parameters: z.object({
        scriptPath: z.string().describe('脚本路径，相对于 workspace/skills/ 目录'),
        args: z.array(z.string()).describe('传给脚本的命令行参数列表'),
      }),
      execute: async ({scriptPath, args}) => {
        const fullPath = path.join(workspaceDir, 'skills', scriptPath)
        const result = await sandbox.execute(fullPath, args)
        console.log(`  [sandbox] ${scriptPath} → ${result.slice(0, 120)}`)
        return result
      },
    }),
  }

  return {
    async kickoff(userRequest) {
      console.log(`[DigitalWorker] workspace=${path.basename(workspaceDir)}`)
      const {text} = await generateText({
        model: anthropic(model),
        system: `你是一名数字员工。以下是你的身份、工作规范和记忆：\n\n${context}`,
        prompt: userRequest,
        tools,
        maxSteps: 20,
        maxTokens: 16384,
      })
      return text
    },
  }
}
