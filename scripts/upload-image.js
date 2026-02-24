#!/usr/bin/env node
/**
 * 微信公众号图片上传工具
 * 使用方式：
 *   node scripts/upload-image.js <image-file>
 *
 * 示例：
 *   node scripts/upload-image.js cover.jpg
 */

const fs = require('fs')
const https = require('https')
const path = require('path')

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'wechat-config.json')

// 读取配置
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ 配置文件不存在: scripts/wechat-config.json')
    process.exit(1)
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))

  if (!config.appid || !config.secret) {
    console.error('❌ 配置文件缺少 appid 或 secret')
    process.exit(1)
  }

  return config
}

// 获取 access_token
function getAccessToken(appid, secret) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`

    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            if (result.access_token) {
              resolve(result.access_token)
            } else {
              reject(new Error(`获取 access_token 失败: ${result.errmsg}`))
            }
          } catch (err) {
            reject(err)
          }
        })
      })
      .on('error', reject)
  })
}

// 上传图片素材（永久）
function uploadImage(accessToken, imagePath) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(imagePath)
    const imageData = fs.readFileSync(imagePath)

    // 生成 multipart/form-data 边界
    const boundary =
      '----WebKitFormBoundary' + Math.random().toString(36).substring(2)

    // 构建表单数据
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="media"; filename="${fileName}"`,
      `Content-Type: ${getContentType(imagePath)}`,
      '',
      imageData.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n')

    const options = {
      hostname: 'api.weixin.qq.com',
      path: `/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData, 'binary'),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.media_id) {
            resolve(result)
          } else {
            reject(
              new Error(
                `上传失败: ${result.errmsg} (errcode: ${result.errcode})`,
              ),
            )
          }
        } catch (err) {
          reject(err)
        }
      })
    })

    req.on('error', reject)
    req.write(formData, 'binary')
    req.end()
  })
}

// 获取文件的 Content-Type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  }
  return types[ext] || 'application/octet-stream'
}

// 主函数
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('使用方法：')
    console.log('  node scripts/upload-image.js <image-file>')
    console.log('\n示例：')
    console.log('  node scripts/upload-image.js cover.jpg')
    console.log('  node scripts/upload-image.js /path/to/image.png')
    console.log('\n支持的格式：')
    console.log('  jpg, jpeg, png, gif, bmp')
    console.log('\n要求：')
    console.log('  - 图片大小不超过 2M')
    console.log('  - 建议尺寸：900x500 或 1:1')
    process.exit(0)
  }

  const imagePath = args[0]

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 文件不存在: ${imagePath}`)
    process.exit(1)
  }

  // 检查文件大小
  const stats = fs.statSync(imagePath)
  const fileSizeMB = stats.size / (1024 * 1024)
  if (fileSizeMB > 2) {
    console.error(`❌ 图片过大: ${fileSizeMB.toFixed(2)}MB，最大支持 2MB`)
    process.exit(1)
  }

  // 检查文件格式
  const ext = path.extname(imagePath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
    console.error(`❌ 不支持的图片格式: ${ext}`)
    console.error('支持的格式：jpg, jpeg, png, gif, bmp')
    process.exit(1)
  }

  console.log('🚀 开始上传图片到微信公众号...\n')

  try {
    // 1. 读取配置
    console.log('📖 读取配置文件...')
    const config = loadConfig()

    // 2. 获取 access_token
    console.log('🔑 获取 access_token...')
    const accessToken = await getAccessToken(config.appid, config.secret)
    console.log('✅ access_token 获取成功\n')

    // 3. 上传图片
    console.log('📤 正在上传图片...')
    console.log(`📄 文件: ${imagePath}`)
    console.log(`📊 大小: ${fileSizeMB.toFixed(2)}MB`)

    const result = await uploadImage(accessToken, imagePath)

    console.log('\n✅ 图片上传成功！')
    console.log(`📦 Media ID: ${result.media_id}`)
    console.log(`🔗 URL: ${result.url}`)

    console.log('\n💡 下一步：')
    console.log('1. 将 media_id 添加到 scripts/wechat-config.json：')
    console.log(`   "thumb_media_id": "${result.media_id}"`)
    console.log('2. 然后就可以使用 upload-to-wechat.js 上传文章了')

    // 自动更新配置文件
    console.log('\n🔄 是否自动更新配置文件？')
    console.log('手动更新：编辑 scripts/wechat-config.json')
    console.log(`添加：  "thumb_media_id": "${result.media_id}"`)
  } catch (error) {
    console.error('\n❌ 上传失败：', error.message)
    console.log('\n💡 常见问题：')
    console.log('1. 检查图片格式是否支持（jpg/png/gif/bmp）')
    console.log('2. 检查图片大小是否超过 2MB')
    console.log('3. 检查网络连接是否正常')
    console.log('4. 检查 IP 白名单是否已配置')
    process.exit(1)
  }
}

main()
