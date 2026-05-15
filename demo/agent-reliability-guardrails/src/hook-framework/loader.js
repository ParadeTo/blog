import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { normalizeEventType } from './registry.js';

export function isInside(parentDir, childPath) {
  const parent = path.resolve(parentDir);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function splitRef(ref) {
  if (typeof ref !== 'string') {
    throw new Error('handler reference must be a string');
  }

  const separatorIndex = ref.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) {
    throw new Error(`malformed hook reference: ${ref}`);
  }

  return {
    moduleName: ref.slice(0, separatorIndex),
    exportName: ref.slice(separatorIndex + 1),
  };
}

export class HookLoader {
  #strategies = Object.create(null);

  constructor(registry, { logger = console.error } = {}) {
    this.registry = registry;
    this.logger = logger;
    this.moduleCache = new Map();
  }

  get strategies() {
    return { ...this.#strategies };
  }

  async loadTwoLayers(globalDir, workspaceDir) {
    await this.loadFromDirectory(globalDir, 'global');
    await this.loadFromDirectory(path.join(workspaceDir, 'hooks'), 'workspace');
  }

  async loadFromDirectory(hooksDir, layerName = '') {
    const configPath = path.join(hooksDir, 'hooks.yaml');
    let raw;

    try {
      raw = await fs.readFile(configPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      this.log('failed to read hooks config', { hooksDir, error });
      return;
    }

    let config;
    try {
      config = YAML.parse(raw) ?? {};
    } catch (error) {
      this.log('failed to parse hooks config', { hooksDir, error });
      return;
    }

    await this.loadHooks(hooksDir, layerName, config.hooks ?? {});
    await this.loadStrategies(hooksDir, layerName, config.strategies ?? {});
  }

  async loadHooks(hooksDir, layerName, hooks) {
    for (const [eventName, entries] of Object.entries(hooks ?? {})) {
      let eventType;
      try {
        eventType = normalizeEventType(eventName);
      } catch (error) {
        this.log('invalid hook event', { eventName, error });
        continue;
      }

      for (const entry of asArray(entries)) {
        const handlerRef = typeof entry === 'string' ? entry : entry?.handler;

        try {
          const { moduleName, exportName } = splitRef(handlerRef);
          const module = await this.loadModule(hooksDir, moduleName);
          const handler = module[exportName];

          if (typeof handler !== 'function') {
            this.log('hook export is not a function', { eventName, handler: handlerRef });
            continue;
          }

          this.registry.register(eventType, handler, this.handlerName(layerName, handlerRef));
        } catch (error) {
          this.log('failed to load hook handler', { eventName, handler: handlerRef, error });
        }
      }
    }
  }

  async loadStrategies(hooksDir, layerName, strategies) {
    for (const entry of Object.values(strategies ?? {})) {
      const classRef = entry?.class;

      try {
        const { moduleName, exportName } = splitRef(classRef);
        const module = await this.loadModule(hooksDir, moduleName);
        const StrategyClass = module[exportName];

        if (typeof StrategyClass !== 'function') {
          this.log('strategy export is not a class', { class: classRef });
          continue;
        }

        const instance = new StrategyClass(entry.config ?? {});
        this.#strategies[moduleName] = instance;

        for (const [eventName, methodName] of Object.entries(entry.hooks ?? {})) {
          let eventType;
          try {
            eventType = normalizeEventType(eventName);
          } catch (error) {
            this.log('invalid strategy event', { eventName, class: classRef, error });
            continue;
          }

          const method = instance[methodName];
          if (typeof method !== 'function') {
            this.log('strategy hook method is not a function', {
              eventName,
              class: classRef,
              methodName,
            });
            continue;
          }

          this.registry.register(
            eventType,
            method.bind(instance),
            this.handlerName(layerName, `${classRef}.${methodName}`),
          );
        }
      } catch (error) {
        this.log('failed to load strategy', { class: classRef, error });
      }
    }
  }

  async loadModule(hooksDir, moduleName) {
    const modulePath = path.resolve(hooksDir, `${moduleName}.js`);

    let realHooksDir;
    let realModulePath;
    try {
      realHooksDir = await fs.realpath(hooksDir);
    } catch (error) {
      throw new Error(`hooks directory not found: ${hooksDir}`, { cause: error });
    }

    try {
      realModulePath = await fs.realpath(modulePath);
    } catch (error) {
      throw new Error(`hook module not found: ${moduleName}`, { cause: error });
    }

    if (!isInside(realHooksDir, realModulePath)) {
      throw new Error(`hook module must stay inside hooks directory: ${moduleName}`);
    }

    if (this.moduleCache.has(realModulePath)) {
      return this.moduleCache.get(realModulePath);
    }

    const module = await import(pathToFileURL(realModulePath).href);
    this.moduleCache.set(realModulePath, module);

    return module;
  }

  handlerName(layerName, ref) {
    return layerName ? `[${layerName}] ${ref}` : ref;
  }

  log(message, fields = {}) {
    this.logger({ message, ...fields });
  }
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
