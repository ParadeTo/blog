import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'

let _config = null

export function loadConfig(configPath = 'config.yaml') {
  if (_config) return _config
  const raw = fs.readFileSync(configPath, 'utf-8')
  // Replace ${ENV_VAR} with env values
  const resolved = raw.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '')
  _config = yaml.load(resolved)
  return _config
}

export function getConfig() {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.')
  return _config
}
