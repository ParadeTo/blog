import {execFile} from 'child_process'
import {promisify} from 'util'
import path from 'path'
import {fileURLToPath} from 'url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class PodmanSandbox {
  constructor({workspaceDir, sharedDir, timeoutMs = 30000} = {}) {
    this._workspaceDir = path.resolve(workspaceDir)
    this._sharedDir = path.resolve(sharedDir)
    this._timeoutMs = timeoutMs
  }

  async execute(scriptPath, args = []) {
    const skillsDir = path.join(this._workspaceDir, 'skills')
    const containerScript = `/mnt/skills/${path.relative(skillsDir, path.resolve(scriptPath))}`

    const cmd = [
      'run', '--rm',
      `--timeout=${Math.ceil(this._timeoutMs / 1000)}`,
      '-v', `${skillsDir}:/mnt/skills:ro`,
      '-v', `${this._workspaceDir}:/workspace:rw`,
      '-v', `${this._sharedDir}:/mnt/shared:rw`,
      'digital-team-sandbox',
      'node', containerScript,
      ...args,
    ]

    try {
      const {stdout, stderr} = await execFileAsync('podman', cmd, {timeout: this._timeoutMs})
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (e) {
      if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
      return `执行失败: ${e.stderr || e.message}`
    }
  }
}
