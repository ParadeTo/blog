import {execFile} from 'child_process'
import {promisify} from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

export class PodmanSandbox {
  constructor({image = 'xiaoquan-sandbox:latest', timeoutMs = 30000, dataDir = './data'} = {}) {
    this._image = image
    this._timeoutMs = timeoutMs
    this._dataDir = path.resolve(dataDir)
    this._credentialsDir = path.join(this._dataDir, '.sandbox-credentials')
  }

  writeCredentials(credentials) {
    fs.mkdirSync(this._credentialsDir, {recursive: true})
    for (const [name, data] of Object.entries(credentials)) {
      fs.writeFileSync(
        path.join(this._credentialsDir, `${name}.json`),
        JSON.stringify(data, null, 2)
      )
    }
  }

  async execute(scriptPath, args = '', {sessionDir = null} = {}) {
    const mounts = this._buildMounts(sessionDir)
    const containerScriptPath = `/mnt/skills/${path.relative(path.resolve('skills'), scriptPath)}`

    const cmd = [
      'run', '--rm',
      `--timeout=${Math.ceil(this._timeoutMs / 1000)}`,
      '--network=host',
      ...mounts,
      this._image,
      'python3', containerScriptPath, ...args.split(' ').filter(Boolean),
    ]

    try {
      const {stdout, stderr} = await execFileAsync('podman', cmd, {timeout: this._timeoutMs})
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (e) {
      if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
      return `执行失败: ${e.message}`
    }
  }

  async executeCode(code, language = 'python', {sessionDir = null} = {}) {
    const mounts = this._buildMounts(sessionDir)
    const cmd = [
      'run', '--rm', '-i',
      `--timeout=${Math.ceil(this._timeoutMs / 1000)}`,
      '--network=host',
      ...mounts,
      this._image,
      language === 'python' ? 'python3' : 'node',
      '-c', code,
    ]

    try {
      const {stdout, stderr} = await execFileAsync('podman', cmd, {
        timeout: this._timeoutMs,
      })
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (e) {
      if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
      return `执行失败: ${e.message}`
    }
  }

  _buildMounts(sessionDir) {
    const mounts = [
      '-v', `${path.resolve('skills')}:/mnt/skills:ro`,
    ]
    if (fs.existsSync(this._credentialsDir)) {
      mounts.push('-v', `${this._credentialsDir}:/workspace/.config:ro`)
    }
    if (sessionDir) {
      const absSessionDir = path.resolve(sessionDir)
      fs.mkdirSync(absSessionDir, {recursive: true})
      mounts.push('-v', `${absSessionDir}:/workspace/session:rw`)
    }
    return mounts
  }
}
