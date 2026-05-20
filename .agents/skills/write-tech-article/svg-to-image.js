#!/usr/bin/env node
/**
 * 将 SVG 文件转换为 PNG 或 JPG
 * 用法：node svg-to-image.js <input.svg> [png|jpg] [width]
 * 示例：node svg-to-image.js diagram.svg png 800
 */
const { readFileSync } = require('fs')
const { resolve, basename, dirname, extname } = require('path')

const [,, input, format = 'png', widthArg] = process.argv

if (!input) {
  console.error('用法：node svg-to-image.js <input.svg> [png|jpg] [width]')
  process.exit(1)
}

if (!['png', 'jpg', 'jpeg'].includes(format)) {
  console.error('格式必须是 png 或 jpg')
  process.exit(1)
}

const inputPath = resolve(input)
if (extname(inputPath).toLowerCase() !== '.svg') {
  console.error('输入文件必须是 .svg')
  process.exit(1)
}

const outputExt = format === 'jpeg' ? 'jpg' : format
const outputPath = resolve(dirname(inputPath), basename(inputPath, '.svg') + '.' + outputExt)
const width = widthArg ? parseInt(widthArg) : undefined

async function main() {
  // 优先用 sharp
  try {
    const sharp = require('sharp')
    const svgBuffer = readFileSync(inputPath)
    let pipeline = sharp(svgBuffer)
    if (width) pipeline = pipeline.resize(width)
    pipeline = format === 'jpg' || format === 'jpeg'
      ? pipeline.jpeg({ quality: 90 })
      : pipeline.png()
    await pipeline.toFile(outputPath)
    console.log(`已保存：${outputPath}`)
    return
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e
  }

  // 降级用 playwright
  try {
    const { chromium } = require('playwright')
    const svgContent = readFileSync(inputPath, 'utf-8')
    const viewBoxMatch = svgContent.match(/viewBox=["'][\d.]+ [\d.]+ ([\d.]+) ([\d.]+)["']/)
    const widthMatch = svgContent.match(/width=["']([\d.]+)["']/)
    const heightMatch = svgContent.match(/height=["']([\d.]+)["']/)
    const svgW = width ?? (widthMatch ? parseInt(widthMatch[1]) : viewBoxMatch ? parseInt(viewBoxMatch[1]) : 800)
    const svgH = heightMatch ? parseInt(heightMatch[1]) : viewBoxMatch ? parseInt(viewBoxMatch[2]) : 600

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:white">
      <img src="data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}"
           width="${svgW}" height="${svgH}" style="display:block">
    </body></html>`

    const browser = await chromium.launch()
    const page = await browser.newPage()
    await page.setViewportSize({ width: svgW, height: svgH })
    await page.setContent(html)
    const imgEl = await page.$('img')
    const type = (format === 'jpg' || format === 'jpeg') ? 'jpeg' : 'png'
    await imgEl.screenshot({ path: outputPath, type, ...(type === 'jpeg' ? { quality: 90 } : {}) })
    await browser.close()
    console.log(`已保存：${outputPath}`)
    return
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e
  }

  console.error('转换失败，请先安装依赖（二选一）：')
  console.error('  npm install sharp')
  console.error('  npm install playwright && npx playwright install chromium')
  process.exit(1)
}

main().catch(e => { console.error(e.message); process.exit(1) })
