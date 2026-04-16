import * as lark from '@larksuiteoapi/node-sdk'
import {resolveRoutingKey} from './session-key.js'
import {createInboundMessage} from '../models.js'

export class FeishuListener {
  constructor({appId, appSecret, onMessage, allowedChats = []}) {
    this._onMessage = onMessage
    this._allowedChats = new Set(allowedChats)
    this._client = new lark.Client({appId, appSecret})

    this._wsClient = new lark.WSClient({
      appId,
      appSecret,
      eventDispatcher: new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => {
          await this._handleMessage(data)
        },
      }),
      loggerLevel: lark.LoggerLevel.WARN,
    })
  }

  async start() {
    await this._wsClient.start()
  }

  _isChatAllowed(chatId, chatType) {
    if (chatType === 'p2p') return true
    if (this._allowedChats.size === 0) return true
    return this._allowedChats.has(chatId)
  }

  async _handleMessage(data) {
    try {
      const {message, sender} = data
      const chatType = message.chat_type
      const chatId = message.chat_id
      const senderId = sender.sender_id?.open_id
      const msgId = message.message_id
      const threadId = message.thread_id || null

      if (!this._isChatAllowed(chatId, chatType)) return

      const routingKey = resolveRoutingKey(chatType, senderId, chatId, threadId)
      const {content, attachment} = this._extractContent(message.message_type, message.content)

      const inbound = createInboundMessage({
        routingKey,
        content,
        msgId,
        rootId: message.root_id || msgId,
        senderId,
        ts: parseInt(message.create_time) || Date.now(),
        attachment,
      })

      await this._onMessage(inbound)
    } catch (e) {
      console.error('[FeishuListener] handleMessage error:', e.message)
    }
  }

  _extractContent(msgType, contentJson) {
    let parsed
    try {
      parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson
    } catch {
      return {content: '', attachment: null}
    }

    let content = ''
    let attachment = null

    if (msgType === 'text') {
      content = parsed.text || ''
    } else if (msgType === 'post') {
      content = this._extractPostText(parsed)
    } else if (msgType === 'image') {
      attachment = {msgType: 'image', fileKey: parsed.image_key, fileName: `${parsed.image_key}.jpg`}
    } else if (msgType === 'file') {
      attachment = {msgType: 'file', fileKey: parsed.file_key, fileName: parsed.file_name || parsed.file_key}
    }

    return {content, attachment}
  }

  _extractPostText(data) {
    const parts = []
    const zhContent = data?.zh_cn || data?.en_us
    if (!zhContent) return ''
    if (zhContent.title) parts.push(zhContent.title)
    for (const paragraph of (zhContent.content || [])) {
      for (const element of paragraph) {
        if (element.tag === 'text') parts.push(element.text)
      }
    }
    return parts.join(' ')
  }
}

export async function runForever(listener) {
  while (true) {
    try {
      await listener.start()
    } catch (e) {
      console.error('[FeishuListener] connection error, retrying in 5s:', e.message)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}
