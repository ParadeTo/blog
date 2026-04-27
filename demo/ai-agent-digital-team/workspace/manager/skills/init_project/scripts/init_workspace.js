#!/usr/bin/env node
/**
 * 初始化共享工作区目录结构（幂等）
 *
 * 用法：
 *   node init_workspace.js --shared-dir /mnt/shared --roles manager,pm
 */

import fs from 'fs'
import path from 'path'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    args[argv[i].slice(2)] = argv[i + 1]
    i++
  }
}

const sharedDir = args['shared-dir']
const roles = (args.roles || 'manager,pm').split(',')
const created = []

function mkdirIfAbsent(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true})
    created.push(dir)
  }
}

function writeIfAbsent(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, content, 'utf-8')
    created.push(filePath)
  }
}

mkdirIfAbsent(path.join(sharedDir, 'needs'))
mkdirIfAbsent(path.join(sharedDir, 'design'))
mkdirIfAbsent(path.join(sharedDir, 'mailboxes'))

for (const role of roles) {
  writeIfAbsent(path.join(sharedDir, 'mailboxes', `${role}.json`), '[]')
}

console.log(JSON.stringify({ok: true, created}))
