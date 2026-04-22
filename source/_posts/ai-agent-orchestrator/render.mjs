import puppeteer from 'puppeteer-core'
import {fileURLToPath} from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const files = process.argv.slice(2)
if (!files.length) { console.error('Usage: node render.mjs <file.svg> ...'); process.exit(1) }

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})

for (const file of files) {
  const abs = path.resolve(__dirname, file)
  const page = await browser.newPage()
  await page.setViewport({width: 1600, height: 1200, deviceScaleFactor: 2})
  await page.goto(`file://${abs}`)
  await page.waitForSelector('svg')
  const svg = await page.$('svg')
  const box = await svg.boundingBox()
  const outName = file.replace(/\.svg$/, '.png')
  const outPath = path.resolve(__dirname, outName)
  await page.screenshot({path: outPath, clip: {x: box.x, y: box.y, width: box.width, height: box.height}, omitBackground: false})
  console.log(`${outName}: ${Math.round(fs.statSync(outPath).size / 1024)}K`)
  await page.close()
}
await browser.close()
