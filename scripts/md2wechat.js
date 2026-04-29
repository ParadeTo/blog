#!/usr/bin/env node
/**
 * Markdown 转微信公众号格式工具（样式基于 mdnice 姹紫主题）
 * 使用方式：
 *   node scripts/md2wechat.js <input.md> [output.html]
 */

const fs = require('fs')
const path = require('path')

// 姹紫主题色
const PURPLE = 'rgb(119, 48, 152)'
const PURPLE_LIGHT = 'rgb(150, 84, 181)'
const FONT_FAMILY = "Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif"
const MONO_FAMILY = "Operator Mono, Consolas, Monaco, Menlo, monospace"

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parseMarkdown(md) {
  let html = md

  // 移除 Front Matter
  html = html.replace(/^---[\s\S]*?---\n/m, '')

  // 代码块先占位，避免被其他规则误处理
  const codeBlocks = []
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`
    const escaped = escapeHtml(code.trim())
    codeBlocks.push(
      `<pre style="margin-top:10px;margin-bottom:10px;border-radius:5px;overflow-x:auto;` +
      `box-shadow:rgba(0,0,0,0.55) 0px 2px 10px;">` +
      `<code style="display:block;padding:16px;color:rgb(171,178,191);` +
      `font-family:${MONO_FAMILY};font-size:12px;line-height:1.8;` +
      `background:rgb(40,44,52);border-radius:5px;-webkit-overflow-scrolling:touch;">` +
      `${escaped}</code></pre>`
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

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const imgSrc = src.startsWith('http') ? src : `[需替换CDN地址: ${src}]`
    return `<figure style="margin:10px 0;display:flex;flex-direction:column;justify-content:center;align-items:center;">` +
           `<img src="${imgSrc}" alt="${alt}" style="display:block;margin:0 auto;max-width:100%;" /></figure>`
  })

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" style="text-decoration:none;color:${PURPLE};word-wrap:break-word;` +
    `font-weight:bold;border-bottom:1px solid ${PURPLE};">$1</a>`
  )

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

  // 还原代码块
  codeBlocks.forEach((block, i) => {
    html = html.replace(`%%CODEBLOCK_${i}%%`, block)
  })

  return html
}

function convertMdToWechat(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ 文件不存在: ${inputFile}`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(inputFile, 'utf8')
  const contentHtml = parseMarkdown(markdown)

  const sectionStyle = [
    `padding:0 10px`,
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

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>微信公众号预览</title>
</head>
<body style="background:#fff;padding:20px;">
  <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com" style="${sectionStyle}">
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
  console.log('\n💡 图片需替换为 CDN 地址')
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

convertMdToWechat(inputFile, outputFile)
