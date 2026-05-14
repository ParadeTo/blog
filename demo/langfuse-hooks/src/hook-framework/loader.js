import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
import { normalizeEventType } from './registry.js'

function isInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export class HookLoader {
  constructor(registry, { logger = console.error } = {}) {
    this.registry = registry
    this.logger = logger
    this.moduleCache = new Map()
  }

  async loadFromDirectory(hooksDir, layerName = '') {
    const yamlPath = path.join(hooksDir, 'hooks.yaml')

    try {
      await fs.access(yamlPath)
    } catch {
      return
    }

    const raw = await fs.readFile(yamlPath, 'utf8')
    const config = YAML.parse(raw) ?? {}

    for (const [eventName, handlerList] of Object.entries(config.hooks ?? {})) {
      let eventType
      try {
        eventType = normalizeEventType(eventName)
      } catch (error) {
        this.logger(`[HookLoader] ${error.message}`)
        continue
      }

      for (const entry of handlerList ?? []) {
        const handlerRef = entry.handler
        if (!handlerRef || !handlerRef.includes('.')) {
          this.logger(`[HookLoader] invalid handler: ${handlerRef}`)
          continue
        }

        const [moduleName, funcName] = handlerRef.split(/\.(?=[^.]+$)/)
        const modulePath = path.resolve(hooksDir, `${moduleName}.js`)

        if (!isInside(path.resolve(hooksDir), modulePath)) {
          this.logger(`[HookLoader] path traversal blocked: ${handlerRef}`)
          continue
        }

        try {
          await fs.access(modulePath)
        } catch {
          this.logger(`[HookLoader] module not found: ${modulePath}`)
          continue
        }

        const module = await this.importModule(modulePath)
        const handler = module[funcName]

        if (typeof handler !== 'function') {
          this.logger(`[HookLoader] function not found: ${handlerRef}`)
          continue
        }

        const display = `[${layerName}] ${handlerRef}`
        this.registry.register(eventType, handler, display)
      }
    }
  }

  async loadTwoLayers(globalDir, workspaceDir) {
    await this.loadFromDirectory(globalDir, 'global')
    await this.loadFromDirectory(path.join(workspaceDir, 'hooks'), 'workspace')
  }

  async importModule(modulePath) {
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath)
    }

    const module = await import(pathToFileURL(modulePath).href)
    this.moduleCache.set(modulePath, module)
    return module
  }
}
