#!/usr/bin/env node
/**
 * Markdown 转微信公众号格式工具（样式基于 mdnice 姹紫主题）
 * 使用方式：
 *   node scripts/md2wechat.js <input.md> [output.html]
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const hljs = require('highlight.js')

// 姹紫主题色
const PURPLE = 'rgb(119, 48, 152)'
const PURPLE_LIGHT = 'rgb(150, 84, 181)'
const FONT_FAMILY = "Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif"
const MONO_FAMILY = "Operator Mono, Consolas, Monaco, Menlo, monospace"

// highlight.js atom-one-dark 配色（内联 style 版）
const HJS_COLORS = {
  'hljs-comment': 'color:#5c6370;font-style:italic',
  'hljs-keyword': 'color:#c678dd',
  'hljs-built_in': 'color:#e6c07b',
  'hljs-string': 'color:#98c379',
  'hljs-number': 'color:#d19a66',
  'hljs-literal': 'color:#56b6c2',
  'hljs-title': 'color:#61aeee',
  'hljs-attr': 'color:#d19a66',
  'hljs-variable': 'color:#e06c75',
  'hljs-type': 'color:#e6c07b',
  'hljs-name': 'color:#e06c75',
  'hljs-selector-class': 'color:#d19a66',
  'hljs-selector-id': 'color:#d19a66',
  'hljs-params': 'color:#abb2bf',
  'hljs-subst': 'color:#abb2bf',
  'hljs-function': 'color:#61aeee',
  'hljs-punctuation': 'color:#abb2bf',
  'hljs-property': 'color:#abb2bf',
  'hljs-operator': 'color:#56b6c2',
  'hljs-tag': 'color:#e06c75',
  'hljs-meta': 'color:#5c6370',
  'hljs-section': 'color:#61aeee;font-weight:bold',
  'hljs-addition': 'color:#98c379',
  'hljs-deletion': 'color:#e06c75',
}

function hljsToInlineStyle(html) {
  return html.replace(/<span class="([^"]+)">/g, (_, cls) => {
    const styles = cls.split(' ').map(c => HJS_COLORS[c] || '').filter(Boolean).join(';')
    return styles ? `<span style="${styles}">` : '<span>'
  })
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 只处理文本节点（标签之间），不碰标签属性里的空格
function processCodeTextNodes(html) {
  return html.split(/(<[^>]+>)/).map((part, i) => {
    if (i % 2 === 1) return part  // HTML 标签，原样返回
    return part
      .replace(/\n/g, '<br>')
      .replace(/ /g, '&nbsp;')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
  }).join('')
}

function loadWechatConfig() {
  const configFile = path.join(__dirname, 'wechat-config.json')
  if (!fs.existsSync(configFile)) return null
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
  if (!config.appid || !config.secret) return null
  return config
}

function getAccessToken(appid, secret) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.access_token) resolve(result.access_token)
          else reject(new Error(`获取 access_token 失败: ${result.errmsg}`))
        } catch (err) { reject(err) }
      })
    }).on('error', reject)
  })
}

function getImageContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp'}[ext] || 'application/octet-stream'
}

function uploadImageToWechat(accessToken, imagePath) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(imagePath)
    const imageData = fs.readFileSync(imagePath)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2)
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="media"; filename="${fileName}"`,
      `Content-Type: ${getImageContentType(imagePath)}`,
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
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.url) resolve(result.url)
          else reject(new Error(`上传失败: ${result.errmsg} (errcode: ${result.errcode})`))
        } catch (err) { reject(err) }
      })
    })
    req.on('error', reject)
    req.write(formData, 'binary')
    req.end()
  })
}

function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/)
    if (m) result[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return result
}

function parseMarkdown(md, imageUrlMap = new Map()) {
  let html = md

  // 移除 Front Matter
  html = html.replace(/^---[\s\S]*?---\n/m, '')

  // 代码块先占位，避免被其他规则误处理
  const codeBlocks = []
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`
    let highlighted
    try {
      highlighted = lang
        ? hljs.highlight(code.trim(), {language: lang, ignoreIllegals: true}).value
        : hljs.highlightAuto(code.trim()).value
    } catch (e) {
      highlighted = escapeHtml(code.trim())
    }
    // 只反转义安全字符实体，然后处理文本节点的换行和空格
    const inlined = processCodeTextNodes(
      hljsToInlineStyle(highlighted)
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
    codeBlocks.push(
      `<pre style="margin-top:10px;margin-bottom:10px;border-radius:5px;overflow-x:auto;` +
      `box-shadow:rgba(0,0,0,0.55) 0px 2px 10px;` +
      `-webkit-hyphens:none;hyphens:none;word-break:normal;">` +
      `<code style="display:block;padding:16px;color:rgb(171,178,191);` +
      `font-family:${MONO_FAMILY};font-size:12px;line-height:1.8;` +
      `background:rgb(40,44,52);border-radius:5px;` +
      `-webkit-hyphens:none;hyphens:none;word-break:normal;">` +
      `${inlined}</code></pre>`
    )
    return placeholder
  })

  // 标题
  html = html.replace(/^### (.+)$/gim, (_, title) =>
    `<h3 style="margin-top:30px;margin-bottom:15px;padding:0;display:flex;">` +
    `<span style="display:none"></span>` +
    `<span style="font-size:20px;color:${PURPLE};line-height:1.5em;font-weight:bold;display:block;">${title}</span>` +
    `<span style="display:none"></span></h3>`
  )
  html = html.replace(/^## (.+)$/gim, (_, title) =>
    `<h2 style="margin-top:30px;margin-bottom:15px;padding:0;display:flex;justify-content:center;width:100%;">` +
    `<span style="display:none"></span>` +
    `<span style="font-size:22px;color:${PURPLE};border-bottom:1px solid ${PURPLE};` +
    `padding-bottom:10px;width:85%;text-align:center;font-weight:bold;display:block;">${title}</span>` +
    `<span style="display:none"></span></h2>`
  )
  html = html.replace(/^# (.+)$/gim, (_, title) =>
    `<h1 style="margin-top:30px;margin-bottom:15px;padding:0;display:flex;justify-content:center;width:100%;">` +
    `<span style="display:none"></span>` +
    `<span style="font-size:24px;color:${PURPLE};text-align:center;font-weight:bold;display:block;">${title}</span>` +
    `<span style="display:none"></span></h1>`
  )

  // 图片（本地图片用 imageUrlMap 替换，无映射则跳过）
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const resolvedSrc = src.startsWith('http') ? src : (imageUrlMap.get(src) || null)
    if (!resolvedSrc) return ''
    return `<figure style="margin:10px 0;display:flex;flex-direction:column;justify-content:center;align-items:center;">` +
           `<img src="${resolvedSrc}" alt="${alt}" style="display:block;margin:0 auto;max-width:100%;" /></figure>`
  })

  // 链接（相对路径转绝对路径，WeChat 不接受相对 URL）
  const BLOG_BASE = 'https://www.paradeto.com'
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const absHref = href.startsWith('http') ? href : `${BLOG_BASE}${href.startsWith('/') ? '' : '/'}${href}`
    return `<a href="${absHref}" style="text-decoration:none;color:${PURPLE};word-wrap:break-word;` +
           `font-weight:bold;border-bottom:1px solid ${PURPLE};">${text}</a>`
  })

  // 粗体 / 斜体
  html = html.replace(/\*\*(.+?)\*\*/g, `<strong style="color:#000;font-weight:bold;">$1</strong>`)
  html = html.replace(/\*(.+?)\*/g, `<em style="color:#000;font-style:italic;">$1</em>`)

  // 行内代码
  html = html.replace(/`([^`]+)`/g,
    `<code style="font-size:14px;word-wrap:break-word;padding:2px 4px;border-radius:4px;` +
    `margin:0 2px;color:${PURPLE};background-color:rgba(150,84,181,0.1);` +
    `font-family:${MONO_FAMILY};word-break:break-all;">$1</code>`
  )

  // 引用
  html = html.replace(/^> (.+)$/gim,
    `<blockquote style="display:block;font-size:0.9em;overflow:auto;` +
    `border-left:3px solid ${PURPLE_LIGHT};border-right:1px solid ${PURPLE_LIGHT};` +
    `background:rgb(251,249,253);color:rgb(90,90,90);` +
    `padding:10px 10px 10px 20px;margin:20px 0;">$1</blockquote>`
  )

  // 无序列表 / 有序列表
  html = html.replace(/((?:^- .+\n?)+)/gim, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li style="margin:5px 0;line-height:26px;color:rgb(90,90,90);font-size:15px;">` +
      line.replace(/^- /, '') + `</li>`
    ).join('')
    return `<ul style="margin:8px 0;padding-left:25px;color:#000;list-style-type:disc;">${items}</ul>`
  })
  html = html.replace(/((?:^\d+\. .+\n?)+)/gim, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li style="margin:5px 0;line-height:26px;color:rgb(90,90,90);font-size:15px;">` +
      line.replace(/^\d+\. /, '') + `</li>`
    ).join('')
    return `<ol style="margin:8px 0;padding-left:25px;color:#000;list-style-type:decimal;">${items}</ol>`
  })

  // 分割线
  html = html.replace(/^---$/gim,
    `<hr style="height:1px;margin:20px 0;border:none;border-top:1px solid rgba(0,0,0,0.1);">`
  )

  // 表格
  html = html.replace(/((?:^\|.+\|\n)+)/gm, (match) => {
    const rows = match.trim().split('\n')
    if (rows.length < 3) return match

    const headerCells = rows[0].split('|').slice(1, -1)
    const dataRows = rows.slice(2)

    const thHtml = headerCells.map(cell =>
      `<th style="font-size:15px;border:1px solid #ccc;padding:5px 10px;text-align:left;` +
      `font-weight:bold;background-color:rgba(119,48,152,0.1);color:${PURPLE};">${cell.trim()}</th>`
    ).join('')

    const tbodyHtml = dataRows.map((row, i) => {
      const cells = row.split('|').slice(1, -1)
      const bg = i % 2 === 1 ? 'background-color:#F8F8F8;' : 'background-color:#fff;'
      const tdHtml = cells.map(cell =>
        `<td style="font-size:15px;border:1px solid #ccc;padding:5px 10px;text-align:left;${bg}` +
        `color:rgb(90,90,90);">${cell.trim()}</td>`
      ).join('')
      return `<tr style="border-top:1px solid #ccc;${bg}">${tdHtml}</tr>`
    }).join('')

    return `<div style="overflow-x:auto;"><table style="display:table;text-align:left;border-collapse:collapse;width:100%;margin:12px 0;">` +
           `<thead><tr style="background-color:rgba(119,48,152,0.1);">${thHtml}</tr></thead>` +
           `<tbody>${tbodyHtml}</tbody></table></div>`
  })

  // 段落
  html = html
    .split('\n\n')
    .map((para) => {
      para = para.trim()
      if (!para) return ''
      if (para.startsWith('<') || para.startsWith('%%CODEBLOCK')) return para
      return `<p style="color:rgb(90,90,90);font-size:15px;line-height:1.8em;letter-spacing:0.02em;` +
             `text-align:left;text-indent:0;margin:10px 0;padding:8px 0;">` +
             `${para.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  // 还原代码块（用函数避免 $& 等特殊 replacement 模式）
  codeBlocks.forEach((block, i) => {
    html = html.replace(`%%CODEBLOCK_${i}%%`, () => block)
  })

  return html
}

async function convertMdToWechat(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ 文件不存在: ${inputFile}`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(inputFile, 'utf8')
  const frontmatter = parseFrontmatter(markdown)

  // 上传本地图片
  const imageUrlMap = new Map()
  const localImages = [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]
    .map(m => m[2])
    .filter(src => !src.startsWith('http'))
    .filter((src, i, arr) => arr.indexOf(src) === i)  // 去重

  if (localImages.length > 0) {
    const config = loadWechatConfig()
    if (config) {
      console.log(`\n📤 正在上传 ${localImages.length} 张本地图片...`)
      const accessToken = await getAccessToken(config.appid, config.secret)
      for (const src of localImages) {
        const resolvedPath = path.resolve(path.dirname(inputFile), src)
        if (fs.existsSync(resolvedPath)) {
          try {
            const url = await uploadImageToWechat(accessToken, resolvedPath)
            imageUrlMap.set(src, url)
            console.log(`  ✅ ${src}`)
          } catch (e) {
            console.warn(`  ⚠️  ${src} 上传失败: ${e.message}`)
          }
        } else {
          console.warn(`  ⚠️  文件不存在: ${resolvedPath}`)
        }
      }
    } else {
      console.warn('\n⚠️  未找到 wechat-config.json，本地图片已跳过')
    }
  }

  const contentHtml = parseMarkdown(markdown, imageUrlMap)

  const sectionStyle = [
    `padding:0`,
    `font-family:${FONT_FAMILY}`,
    `font-size:15px`,
    `color:rgb(90,90,90)`,
    `line-height:1.8em`,
    `letter-spacing:0.02em`,
    `word-spacing:0`,
    `word-break:break-word`,
    `overflow-wrap:break-word`,
    `text-align:left`,
  ].join(';')

  const articleTitle = frontmatter.title || path.basename(inputFile, '.md')
  const articleDesc = frontmatter.description || ''

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${articleTitle}</title>
</head>
<body style="background:#fff;padding:20px;">
  <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com" data-title="${articleTitle}" data-description="${articleDesc.replace(/"/g, '&quot;')}" style="${sectionStyle}">
${contentHtml}
  </section>
  <script>
    window.onload = function() {
      console.log('✅ 页面加载完成！输入 copyContent() 复制内容');
      window.copyContent = function() {
        const content = document.querySelector('#nice');
        const range = document.createRange();
        range.selectNode(content);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        try {
          document.execCommand('copy');
          alert('✅ 已复制！请粘贴到微信公众号编辑器');
        } catch(err) {
          alert('❌ 复制失败，请手动选择复制');
        }
        window.getSelection().removeAllRanges();
      };
    };
  </script>
</body>
</html>`

  fs.writeFileSync(outputFile, fullHtml, 'utf8')
  console.log('✅ 转换成功！')
  console.log(`📄 输入: ${inputFile}`)
  console.log(`📄 输出: ${outputFile}`)
  if (imageUrlMap.size === 0 && localImages.length > 0) {
    console.log('\n💡 图片需替换为 CDN 地址')
  }
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('用法：node scripts/md2wechat.js <input.md> [output.html]')
  process.exit(0)
}

let inputFile = args[0]
let outputFile = args[1]
if (!outputFile) {
  const outputDir = path.join(__dirname, 'output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {recursive: true})
  outputFile = path.join(outputDir, `${path.basename(inputFile, '.md')}-wechat.html`)
}

convertMdToWechat(inputFile, outputFile).catch(e => {
  console.error('❌ 转换失败:', e.message)
  process.exit(1)
})