import fs from 'fs'
import path from 'path'

export class FeishuDownloader {
  constructor(client, dataDir) {
    this._client = client
    this._dataDir = dataDir
  }

  async download(msgId, attachment, sessionId) {
    const destDir = path.join(this._dataDir, 'workspace', 'sessions', sessionId, 'uploads')
    fs.mkdirSync(destDir, {recursive: true})
    const destPath = path.join(destDir, attachment.fileName)

    try {
      const resp = await this._client.im.messageResource.get({
        path: {message_id: msgId, file_key: attachment.fileKey},
        params: {type: attachment.msgType},
      })

      if (resp?.data) {
        const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data)
        fs.writeFileSync(destPath, buffer)
        return destPath
      }
      return null
    } catch (e) {
      console.error('[FeishuDownloader] download failed:', e.message)
      return null
    }
  }
}
