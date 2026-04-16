export class FeishuSender {
  constructor(client, {maxRetries = 3, retryBackoff = [1, 2, 4]} = {}) {
    this._client = client
    this._maxRetries = maxRetries
    this._retryBackoff = retryBackoff
  }

  _buildCard(content) {
    return JSON.stringify({
      config: {wide_screen_mode: true},
      elements: [{
        tag: 'div',
        text: {content, tag: 'lark_md'},
      }],
    })
  }

  async send(routingKey, content, rootId = null) {
    const card = this._buildCard(content)
    const [type, id] = routingKey.split(':')

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        if (type === 'p2p') {
          await this._client.im.message.create({
            data: {
              receive_id: id,
              msg_type: 'interactive',
              content: card,
            },
            params: {receive_id_type: 'open_id'},
          })
        } else if (type === 'thread') {
          const [chatId, threadRootId] = [routingKey.split(':')[1], routingKey.split(':')[2]]
          await this._client.im.message.reply({
            path: {message_id: threadRootId},
            data: {msg_type: 'interactive', content: card},
          })
        } else {
          await this._client.im.message.create({
            data: {
              receive_id: id,
              msg_type: 'interactive',
              content: card,
            },
            params: {receive_id_type: 'chat_id'},
          })
        }
        return
      } catch (e) {
        if (attempt < this._maxRetries) {
          await new Promise(r => setTimeout(r, this._retryBackoff[attempt] * 1000))
        } else {
          console.error(`[FeishuSender] send failed after ${this._maxRetries} retries:`, e.message)
        }
      }
    }
  }

  async sendThinking(routingKey, rootId = null) {
    try {
      const card = this._buildCard('⏳ 思考中，请稍候...')
      const [type, id] = routingKey.split(':')

      let resp
      if (type === 'p2p') {
        resp = await this._client.im.message.create({
          data: {receive_id: id, msg_type: 'interactive', content: card},
          params: {receive_id_type: 'open_id'},
        })
      } else if (type === 'thread') {
        const threadRootId = routingKey.split(':')[2]
        resp = await this._client.im.message.reply({
          path: {message_id: threadRootId},
          data: {msg_type: 'interactive', content: card},
        })
      } else {
        resp = await this._client.im.message.create({
          data: {receive_id: id, msg_type: 'interactive', content: card},
          params: {receive_id_type: 'chat_id'},
        })
      }
      return resp?.data?.message_id || null
    } catch (e) {
      console.error('[FeishuSender] sendThinking failed:', e.message)
      return null
    }
  }

  async updateCard(cardMsgId, content) {
    try {
      const card = this._buildCard(content)
      await this._client.im.message.patch({
        path: {message_id: cardMsgId},
        data: {content: card},
      })
    } catch (e) {
      console.error('[FeishuSender] updateCard failed:', e.message)
    }
  }

  async sendText(routingKey, content, rootId = null) {
    const [type, id] = routingKey.split(':')
    const data = {
      msg_type: 'text',
      content: JSON.stringify({text: content}),
    }
    try {
      if (type === 'p2p') {
        await this._client.im.message.create({
          data: {...data, receive_id: id},
          params: {receive_id_type: 'open_id'},
        })
      } else {
        await this._client.im.message.create({
          data: {...data, receive_id: id},
          params: {receive_id_type: 'chat_id'},
        })
      }
    } catch (e) {
      console.error('[FeishuSender] sendText failed:', e.message)
    }
  }
}
