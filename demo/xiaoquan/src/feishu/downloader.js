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

      if (resp?.writeFile) {
        await resp.writeFile(destPath)
        console.log(`[FeishuDownloader] saved via writeFile: ${destPath}`)
        return destPath
      }

      if (resp?.data) {
        const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data)
        fs.writeFileSync(destPath, buffer)
        console.log(`[FeishuDownloader] saved via data buffer: ${destPath}`)
        return destPath
      }

      console.error(`[FeishuDownloader] unexpected resp format: keys=${resp ? Object.keys(resp) : 'null'}`)
      return null
    } catch (e) {
      console.error('[FeishuDownloader] download failed:', e.message, e.response?.data || '')
      return null
    }
  }
}
