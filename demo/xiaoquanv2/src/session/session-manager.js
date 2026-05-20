// src/session/session-manager.js
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export class SessionManager {
  constructor(dataDir) {
    this._sessionsDir = path.join(dataDir, 'sessions')
    fs.mkdirSync(this._sessionsDir, {recursive: true})
    const tmpPath = path.join(this._sessionsDir, 'index.json.tmp')
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
  }

  async getOrCreate(routingKey) {
    const index = this._readIndex()
    if (index[routingKey]) {
      const entry = index[routingKey]
      const session = entry.sessions.find(s => s.id === entry.activeSessionId)
      return session || this._createNewSession(routingKey, index)
    }
    return this._createNewSession(routingKey, index)
  }

  async reset(routingKey) {
    const index = this._readIndex()
    return this._createNewSession(routingKey, index)
  }

  async loadHistory(sessionId, maxTurns = 20) {
    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    if (!fs.existsSync(jsonlPath)) return []

    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean)
    const messages = []
    for (const line of lines) {
      const record = JSON.parse(line)
      if (record.type !== 'message') continue
      messages.push({
        role: record.role,
        content: record.content,
        ts: record.ts,
        feishuMsgId: record.feishuMsgId || null,
      })
    }
    return messages.slice(-maxTurns)
  }

  async append(sessionId, {user, feishuMsgId, assistant}) {
    const now = Date.now()
    const userRecord = JSON.stringify({type: 'message', role: 'user', content: user, ts: now, feishuMsgId})
    const assistantRecord = JSON.stringify({type: 'message', role: 'assistant', content: assistant, ts: now})
    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    fs.appendFileSync(jsonlPath, userRecord + '\n' + assistantRecord + '\n')

    const index = this._readIndex()
    for (const key of Object.keys(index)) {
      const entry = index[key]
      const session = entry.sessions.find(s => s.id === sessionId)
      if (session) {
        session.messageCount += 2
        this._writeIndex(index)
        break
      }
    }
  }

  async updateVerbose(routingKey, verbose) {
    const index = this._readIndex()
    let entry = index[routingKey]
    if (!entry) {
      await this.getOrCreate(routingKey)
      const updatedIndex = this._readIndex()
      entry = updatedIndex[routingKey]
      if (!entry) return
      const session = entry.sessions.find(s => s.id === entry.activeSessionId)
      if (session) {
        session.verbose = verbose
        this._writeIndex(updatedIndex)
      }
      return
    }
    const session = entry.sessions.find(s => s.id === entry.activeSessionId)
    if (session) {
      session.verbose = verbose
      this._writeIndex(index)
    }
  }

  _createNewSession(routingKey, index) {
    const sessionId = 's-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      verbose: false,
      messageCount: 0,
    }
    if (!index[routingKey]) {
      index[routingKey] = {activeSessionId: sessionId, sessions: [session]}
    } else {
      index[routingKey].sessions.push(session)
      index[routingKey].activeSessionId = sessionId
    }
    this._writeIndex(index)

    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    const meta = JSON.stringify({type: 'meta', sessionId, routingKey, createdAt: session.createdAt})
    fs.writeFileSync(jsonlPath, meta + '\n')

    return session
  }

  _readIndex() {
    const indexPath = path.join(this._sessionsDir, 'index.json')
    if (!fs.existsSync(indexPath)) return {}
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  }

  _writeIndex(data) {
    const indexPath = path.join(this._sessionsDir, 'index.json')
    const tmpPath = indexPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
    fs.renameSync(tmpPath, indexPath)
  }
}
