import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { buildBootstrapPrompt, loadSkillRegistry, runRealAgent } from '../src/agent/real-agent.js'
import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js'
import { HookLoader } from '../src/hook-framework/loader.js'
import { HookRegistry } from '../src/hook-framework/registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEMO_DIR = path.resolve(__dirname, '..')

describe('demo agent loop', () => {
  it('runs the full hook chain with a chat-completions tool loop', async () => {
    const logger = vi.fn()
    const registry = new HookRegistry({ logger })
    const loader = new HookLoader(registry, { logger })
    const workspaceDir = path.join(DEMO_DIR, 'workspace', 'demo_agent')
    const designDocPath = path.join(workspaceDir, 'output', 'design_doc.md')

    await loader.loadTwoLayers(path.join(DEMO_DIR, 'shared-hooks'), workspaceDir)

    const adapter = new AgentObservabilityAdapter(registry, { sessionId: 'test-session' })
    const backstory = await buildBootstrapPrompt(workspaceDir)
    const skills = await loadSkillRegistry(path.join(workspaceDir, 'skills'))
    const chatClient = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_skill',
                  type: 'function',
                  function: {
                    name: 'skill_loader',
                    arguments: JSON.stringify({ skill_name: 'sop_design' }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_write',
                  type: 'function',
                  function: {
                    name: 'write_file',
                    arguments: JSON.stringify({
                      path: 'workspace/demo_agent/output/design_doc.md',
                      content: '# 技术设计文档\n\n短链接服务需要创建、跳转和统计三个模块。',
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                errcode: 0,
                errmsg: 'success',
                file_path: 'workspace/demo_agent/output/design_doc.md',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 60, completion_tokens: 20 },
      })

    const { result } = await runRealAgent({
      adapter,
      workspaceDir,
      taskDesc: '为一个短链接服务产出技术设计文档',
      backstory,
      skills,
      chatClient,
      llmConfig: {
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3002/v1',
        model: 'gpt-5.4-nano-2026-03-17',
      },
    })
    await adapter.cleanup()

    expect(result.errcode).toBe(0)
    expect(await fs.readFile(designDocPath, 'utf8')).toContain('短链接服务')
    expect(chatClient).toHaveBeenCalledTimes(3)
    expect(logger).not.toHaveBeenCalled()
  })
})
