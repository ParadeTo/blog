import fs from 'fs'
import path from 'path'
import {pathToFileURL} from 'node:url'
import yaml from 'js-yaml'

function isEnabled(entry) {
  return entry?.enabled !== false
}

function isRequired(entry) {
  return entry?.required !== false
}

async function loadSymbol(baseDir, spec) {
  const dot = spec.lastIndexOf('.')
  if (dot === -1) throw new Error(`invalid hook symbol: ${spec}`)

  const moduleName = spec.slice(0, dot)
  const exportName = spec.slice(dot + 1)
  const modulePath = path.resolve(baseDir, `${moduleName}.js`)
  const url = pathToFileURL(modulePath)
  url.searchParams.set('mtime', String(fs.statSync(modulePath).mtimeMs))

  const mod = await import(url.href)
  if (!(exportName in mod)) {
    throw new Error(`missing export ${exportName} in ${modulePath}`)
  }
  return mod[exportName]
}

export class HookLoader {
  constructor(registry, {logger = console} = {}) {
    this._registry = registry
    this._logger = logger
  }

  async load(dir, {failClosedNames = new Set()} = {}) {
    const yamlPath = path.join(dir, 'hooks.yaml')
    const config = yaml.load(fs.readFileSync(yamlPath, 'utf8')) || {}
    const instances = new Map()

    await this._loadObserverHooks(dir, config.hooks || {})
    await this._loadStrategies(dir, config.strategies || [], instances, failClosedNames)

    return instances
  }

  async _loadObserverHooks(dir, hooks) {
    for (const [event, entries] of Object.entries(hooks)) {
      for (const entry of entries || []) {
        if (!isEnabled(entry)) continue
        try {
          const fn = await loadSymbol(dir, entry.handler)
          this._registry.register(event, fn, {
            name: entry.name || entry.handler,
            failClosed: false,
          })
        } catch (err) {
          this._handleLoadError(entry, entry.handler, err)
        }
      }
    }
  }

  async _loadStrategies(dir, strategies, instances, failClosedNames) {
    for (const strategy of strategies) {
      if (!isEnabled(strategy)) continue

      let instance
      try {
        const Klass = await loadSymbol(dir, strategy.class)
        const deps = this._resolveDeps(strategy, instances)
        instance = new Klass(strategy.config || {}, deps)
        instances.set(strategy.name, instance)
      } catch (err) {
        this._handleLoadError(strategy, strategy.name || strategy.class, err)
        continue
      }

      for (const [event, methodName] of Object.entries(strategy.hooks || {})) {
        try {
          const fn = instance[methodName]?.bind(instance)
          if (!fn) throw new Error(`missing method ${methodName} on ${strategy.name}`)
          this._registry.register(event, fn, {
            name: `${strategy.name}.${methodName}`,
            failClosed: failClosedNames.has(strategy.name),
          })
        } catch (err) {
          this._handleLoadError(strategy, `${strategy.name}.${methodName}`, err)
        }
      }
    }
  }

  _resolveDeps(strategy, instances) {
    const deps = {}
    for (const [alias, name] of Object.entries(strategy.deps || {})) {
      deps[alias] = instances.get(name)
      if (!deps[alias]) {
        throw new Error(`missing dependency ${name} for ${strategy.name}`)
      }
    }
    return deps
  }

  _handleLoadError(entry, label, err) {
    if (isRequired(entry)) {
      throw new Error(`failed to load required hook ${label}: ${err.message}`)
    }
    this._logger.warn?.(`[hooks] skipped optional hook ${label}: ${err.message}`)
  }
}
