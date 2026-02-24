#!/usr/bin/env node
/**
 * Markdown 转微信公众号格式工具
 * 使用方式：
 *   node scripts/md2wechat.js <input.md> [output.html]
 *
 * 示例：
 *   node scripts/md2wechat.js source/_posts/ai-spec-driven-dev.md
 *
 * 默认输出到 scripts/output/ 目录
 */

const fs = require('fs')
const path = require('path')

// 简单的 Markdown 转 HTML（支持基础语法，使用内联样式）
function parseMarkdown(md) {
  let html = md

  // 移除 Front Matter
  html = html.replace(/^---[\s\S]*?---\n/m, '')

  // 代码块（需要先处理，避免影响其他规则）
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre data-tool="mdnice编辑器" style="margin-top: 10px; margin-bottom: 10px; border-radius: 5px; box-shadow: rgba(0, 0, 0, 0.55) 0px 2px 10px;"><code style="overflow-x: auto; padding: 16px; color: rgb(171, 178, 191); display: -webkit-box; font-family: Operator Mono, Consolas, Monaco, Menlo, monospace; font-size: 12px; -webkit-overflow-scrolling: touch; padding-top: 15px; background: rgb(40, 44, 52); border-radius: 5px;">${escapeHtml(code.trim())}</code></pre>`
  })

  // 标题
  html = html.replace(/^### (.*$)/gim, (match, title) => {
    return `<h3 data-tool="mdnice编辑器" style="margin-top: 30px; margin-bottom: 15px; padding: 0px; font-weight: bold; color: rgb(0, 0, 0); font-size: 20px;"><span class="prefix" style="display: none;"></span><span class="content">${title}</span><span class="suffix" style="display: none;"></span></h3>`
  })

  html = html.replace(/^## (.*$)/gim, (match, title) => {
    return `<h2 data-tool="mdnice编辑器" style="margin-top: 30px; margin-bottom: 15px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px; display: block;"><span class="prefix" style="display: none;"></span><span class="content" style="font-size: 22px; color: rgb(0, 0, 0); line-height: 1.5em; letter-spacing: 0em; text-align: left; font-weight: bold; display: block;">${title}</span><span class="suffix" style="display: none;"></span></h2>`
  })

  html = html.replace(/^# (.*$)/gim, (match, title) => {
    return `<h1 data-tool="mdnice编辑器" style="margin-top: 30px; margin-bottom: 15px; padding: 0px; font-weight: bold; color: rgb(0, 0, 0); font-size: 24px; text-align: center;"><span class="prefix" style="display: none;"></span><span class="content">${title}</span><span class="suffix" style="display: none;"></span></h1>`
  })

  // 图片（微信公众号需要特殊处理）
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    // 如果是相对路径，提示用户需要替换
    if (!src.startsWith('http')) {
      return `<figure data-tool="mdnice编辑器" style="margin: 0; margin-top: 10px; margin-bottom: 10px; display: flex; flex-direction: column; justify-content: center; align-items: center;"><img src="[需要替换为CDN地址: ${src}]" alt="${alt}" style="display: block; margin: 0 auto; max-width: 100%; border-radius: 8px;" /></figure>`
    }
    return `<figure data-tool="mdnice编辑器" style="margin: 0; margin-top: 10px; margin-bottom: 10px; display: flex; flex-direction: column; justify-content: center; align-items: center;"><img src="${src}" alt="${alt}" style="display: block; margin: 0 auto; max-width: 100%; border-radius: 8px;" /></figure>`
  })

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" style="text-decoration: none; color: rgb(30, 107, 184); word-wrap: break-word; font-weight: bold; border-bottom: 1px solid rgb(30, 107, 184);">$1</a>')

  // 粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold; color: rgb(0, 0, 0);">$1</strong>')

  // 斜体
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: rgb(0, 0, 0);">$1</em>')

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code style="font-size: 90%; color: rgb(239, 112, 96); background: rgb(255, 245, 245); padding: 3px 5px; border-radius: 2px; word-wrap: break-word; font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;">$1</code>')

  // 引用
  html = html.replace(/^> (.*$)/gim, '<blockquote data-tool="mdnice编辑器" style="display: block; font-size: 0.9em; overflow: auto; overflow-scrolling: touch; border-left: 3px solid rgb(0, 0, 0); color: rgb(106, 115, 125); padding: 10px 10px 10px 20px; margin-bottom: 20px; margin-top: 20px; background: rgb(248, 248, 248); border-left-color: rgb(221, 221, 221);">$1</blockquote>')

  // 无序列表
  html = html.replace(/^\- (.*$)/gim, '<li data-tool="mdnice编辑器" style="margin-top: 5px; margin-bottom: 5px; padding: 0px; line-height: 1.7em; color: rgb(0, 0, 0); font-size: 16px; list-style-type: disc;">$1</li>')
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

  // 有序列表
  html = html.replace(/^\d+\. (.*$)/gim, '<li data-tool="mdnice编辑器" style="margin-top: 5px; margin-bottom: 5px; padding: 0px; line-height: 1.7em; color: rgb(0, 0, 0); font-size: 16px; list-style-type: decimal;">$1</li>')

  // 分割线
  html = html.replace(/^---$/gim, '<hr style="margin-top: 20px; margin-bottom: 20px; border: none; border-top: 2px solid rgb(221, 221, 221);">')

  // 段落（简单处理：连续的非标签行合并为段落）
  html = html
    .split('\n\n')
    .map((para) => {
      para = para.trim()
      if (!para) return ''
      if (para.startsWith('<')) return para
      return `<p data-tool="mdnice编辑器" style="color: rgb(0, 0, 0); font-size: 16px; line-height: 1.8em; letter-spacing: 0em; text-align: left; text-indent: 0em; margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 8px; padding-bottom: 8px; padding-left: 0px; padding-right: 0px;">${para.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return html
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function convertMdToWechat(inputFile, outputFile) {
  // 读取 Markdown 文件
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ 文件不存在: ${inputFile}`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(inputFile, 'utf8')

  // 转换为 HTML
  const contentHtml = parseMarkdown(markdown)

  // 生成完整 HTML（使用内联样式，适合微信公众号）
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>微信公众号预览</title>
</head>
<body>
  <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com" style="margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 10px; padding-right: 10px; background-attachment: scroll; background-clip: border-box; background-color: rgba(0, 0, 0, 0); background-image: none; background-origin: padding-box; background-position-x: left; background-position-y: top; background-repeat: no-repeat; background-size: auto; width: auto; font-family: Optima, 'Microsoft YaHei', PingFangSC-regular, serif; font-size: 16px; color: rgb(0, 0, 0); line-height: 1.5em; word-spacing: 0em; letter-spacing: 0em; word-break: break-word; overflow-wrap: break-word; text-align: left;">
    ${contentHtml}
  </section>

  <script>
    // 复制到剪贴板功能
    window.onload = function() {
      const content = document.querySelector('#nice');
      console.log('✅ 页面加载完成！');
      console.log('💡 提示：打开浏览器开发者工具，在 Console 中输入以下命令复制内容：');
      console.log('   copyContent()');

      // 添加全局复制函数
      window.copyContent = function() {
        const range = document.createRange();
        range.selectNode(content);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        try {
          document.execCommand('copy');
          alert('✅ 已复制到剪贴板！\\n请粘贴到微信公众号编辑器');
          console.log('✅ 已复制到剪贴板');
        } catch(err) {
          alert('❌ 复制失败，请手动选择内容复制');
          console.error('复制失败:', err);
        }

        window.getSelection().removeAllRanges();
      };
    };
  </script>
</body>
</html>`

  // 写入输出文件
  fs.writeFileSync(outputFile, fullHtml, 'utf8')

  console.log('✅ 转换成功！')
  console.log(`📄 输入文件: ${inputFile}`)
  console.log(`📄 输出文件: ${outputFile}`)
  console.log('\n📝 使用方法：')
  console.log('1. 用浏览器打开生成的 HTML 文件')
  console.log('2. 在控制台输入 copyContent() 复制内容')
  console.log('3. 粘贴到微信公众号编辑器')
  console.log('\n💡 注意：图片需要替换为 CDN 地址或上传到公众号')
}

// 主程序
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('使用方法：')
  console.log('  node scripts/md2wechat.js <input.md> [output.html]')
  console.log('\n示例：')
  console.log('  node scripts/md2wechat.js source/_posts/ai-spec-driven-dev.md')
  console.log(
    '  node scripts/md2wechat.js source/_posts/ai-spec-driven-dev.md output.html',
  )
  process.exit(0)
}

// 解析参数
let inputFile = args[0]
let outputFile = args[1]

// 默认输出到 scripts/output/ 目录
if (!outputFile) {
  const outputDir = path.join(__dirname, 'output')
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {recursive: true})
  }

  const basename = path.basename(inputFile, '.md')
  outputFile = path.join(outputDir, `${basename}-wechat.html`)
}

convertMdToWechat(inputFile, outputFile)

