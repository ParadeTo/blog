---
name: draw-diagram
description: Use when drawing flowcharts, architecture diagrams, or any technical diagrams for blog articles. Triggers on requests like "draw a diagram", "create a flowchart", "make an architecture diagram", or when an article needs visual illustrations.
---

# 博客流程图绘制规范

## 概述

博客中的流程图/架构图使用**手写 SVG** 绘制，通过 puppeteer-core 调用本地 Chrome 渲染为 PNG。文章中引用 PNG 文件。

## 工作流程

```
1. 编写 .svg 文件
2. 用 render.mjs 渲染为 .png（deviceScaleFactor: 2 保证清晰度）
3. 文章中引用 .png
4. 删除 .svg 和 render.mjs 临时文件
```

---

## 节点类型

### 起始/终止节点（药丸形）

大圆角矩形，填充色背景，白色文字。

```svg
<rect x="370" y="16" width="140" height="38" rx="19" fill="#4361ee" filter="url(#shadow)"/>
<text x="440" y="40" text-anchor="middle" font-family="PingFang SC, Arial, sans-serif" font-size="13" fill="#fff">飞书用户</text>
```

如果有副标题（两行文字），增加高度到 48：

```svg
<rect x="265" y="48" width="230" height="48" rx="20" fill="#4361ee" filter="url(#shadow)"/>
<text x="380" y="69" ... fill="#fff">Agent 调用</text>
<text x="380" y="85" ... font-size="10" fill="#c5d4ff">run_script / execute_code</text>
```

### 处理节点（圆角矩形）

白色背景 + 彩色边框，圆角 `rx="8"`。

```svg
<rect x="155" y="120" width="150" height="40" rx="8" fill="#fff" stroke="#4361ee" stroke-width="1.5" filter="url(#shadow)"/>
<text x="230" y="144" text-anchor="middle" ... font-size="13" fill="#333">读 index.json</text>
```

双行文字时高度用 48：

```svg
<rect x="80" y="220" width="180" height="48" rx="8" fill="#fff" stroke="#4361ee" stroke-width="1.5" filter="url(#shadow)"/>
<text x="170" y="241" ... font-size="13" fill="#333">SessionManager</text>
<text x="170" y="257" ... font-size="11" fill="#888">getOrCreate</text>
```

### 判断节点（菱形） ⚠️ 必须用菱形

所有判断/条件逻辑**必须**用 `<polygon>` 画菱形，不得用矩形替代。

```svg
<!-- 菱形中心在 (cx, cy)，半宽 w，半高 h -->
<!-- points="cx,cy-h  cx+w,cy  cx,cy+h  cx-w,cy" -->
<polygon points="230,180 330,216 230,252 130,216" fill="#fff" stroke="#f72585" stroke-width="1.5" filter="url(#shadow)"/>
<text x="230" y="220" text-anchor="middle" ... font-size="12" fill="#333">有该 routingKey?</text>
```

菱形分支标注（Yes/No）放在连线旁边：

```svg
<line x1="130" y1="216" x2="60" y2="216" stroke="#555" stroke-width="1.5"/>
<text x="90" y="208" ... font-size="11" fill="#888">No</text>
```

### 分组框（虚线矩形）

用于逻辑分组，虚线边框，浅灰填充。

```svg
<rect x="50" y="298" width="780" height="90" rx="8" fill="#f9f9fb" stroke="#aaa" stroke-width="1" stroke-dasharray="6,3"/>
<text x="70" y="316" ... font-size="12" font-weight="600" fill="#555">runAgent() — ReAct 循环</text>
```

组内子节点用更轻的样式：

```svg
<rect x="70" y="328" width="130" height="40" rx="6" fill="#f0f4ff" stroke="#4361ee" stroke-width="1"/>
```

### 提示/警告框

```svg
<rect x="500" y="302" width="210" height="48" rx="6" fill="#fff3cd" stroke="#f0c040" stroke-width="1"/>
<text x="605" y="322" text-anchor="middle" ... font-size="11" fill="#a67c00">凭证从文件读取</text>
```

---

## 连线规则

### ⚠️ 必须用 SVG 线条连接

所有节点之间的连接**必须**用 `<line>` 或 `<path>` + 箭头 marker，**严禁**用文字符号（`↓`、`→`、`←`）模拟箭头。

### 箭头 marker 定义

每个 SVG 文件顶部必须包含：

```svg
<defs>
  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
    <path d="M0,0 L0,6 L8,3 z" fill="#555"/>
  </marker>
  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#00000020"/>
  </filter>
</defs>
```

### 直线连接

```svg
<line x1="440" y1="54" x2="440" y2="74" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
```

### 分支（一分多）

从中心往下引出短竖线，横拉水平线，再从水平线向下分出多条竖线：

```svg
<!-- 短竖线 -->
<line x1="440" y1="188" x2="440" y2="200" stroke="#555" stroke-width="1.5"/>
<!-- 水平线 -->
<line x1="170" y1="200" x2="710" y2="200" stroke="#555" stroke-width="1.5"/>
<!-- 各分支竖线（带箭头） -->
<line x1="170" y1="200" x2="170" y2="218" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="440" y1="200" x2="440" y2="218" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="710" y1="200" x2="710" y2="218" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
```

### 合并（多合一）

多条线汇聚到同一水平线，再从中心引出一条竖线：

```svg
<line x1="60" y1="318" x2="60" y2="338" stroke="#555" stroke-width="1.5"/>
<line x1="60" y1="338" x2="230" y2="338" stroke="#555" stroke-width="1.5"/>
<line x1="370" y1="318" x2="370" y2="338" stroke="#555" stroke-width="1.5"/>
<line x1="370" y1="338" x2="230" y2="338" stroke="#555" stroke-width="1.5"/>
<line x1="230" y1="338" x2="230" y2="358" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
```

### 虚线连接（关联/注释）

```svg
<line x1="470" y1="326" x2="538" y2="326" stroke="#f0c040" stroke-width="1" stroke-dasharray="4,3"/>
```

---

## 色彩规范

| 用途 | 填充色 | 边框/文字色 |
|---|---|---|
| 主流程起点（药丸） | `#4361ee` | 文字 `#fff`，副文字 `#c5d4ff` |
| 输出/结果（药丸） | `#2ec4b6` | 文字 `#fff`，副文字 `#e0fff9` |
| 特殊动作起点（药丸） | `#f72585` | 文字 `#fff` |
| 处理节点 | `#fff` | 边框 `#4361ee` |
| 判断菱形 | `#fff` | 边框 `#f72585` |
| 调度/路由节点 | `#fff` | 边框 `#7b2d8b` |
| 异步/特殊操作 | `#fff` | 边框 `#f0a500`，文字 `#e67e00` |
| 分组虚线框 | `#f9f9fb` | 边框 `#aaa` |
| 组内子节点 | `#f0f4ff` | 边框 `#4361ee`（stroke-width: 1） |
| 提示/警告 | `#fff3cd` | 边框 `#f0c040`，文字 `#a67c00` |
| 灰色/丢弃 | `#eee` | 边框 `#aaa`，文字 `#888` |
| 箭头线 | — | `#555`，stroke-width: 1.5 |

## 字体规范

```
font-family="PingFang SC, Arial, sans-serif"
```

| 用途 | 大小 | 颜色 | 粗细 |
|---|---|---|---|
| 图标题 | 16 | `#333` | 600 |
| 节点主文字 | 13 | `#333` | normal |
| 节点副文字 | 11 | `#888` | normal |
| 小注释 | 10 | `#888` 或 `#aaa` | normal |
| 分组标签 | 12 | `#555` | 600 |
| 分支标注(Yes/No) | 11 | `#888` | normal |

---

## 布局规则

1. **中心轴对齐**：主流程的所有节点中心 x 坐标保持一致
2. **垂直间距**：节点之间的箭头留 20px 左右间距（节点底部 → 箭头 → 下一节点顶部）
3. **水平排列**：并列节点等间距分布，共享同一 y 坐标
4. **分支对称**：菱形的 Yes/No 分支尽量左右对称或上下对称
5. **标注不遮挡**：Yes/No 标注放在线旁边，不覆盖节点
6. **连线不穿越**：连线沿框体外侧绕行，不穿过任何节点

---

## SVG 模板

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="880" height="500" viewBox="0 0 880 500">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#555"/>
    </marker>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#00000020"/>
    </filter>
  </defs>

  <!-- 浅灰背景 -->
  <rect width="880" height="500" fill="#f8f9fa" rx="12"/>

  <!-- 在这里添加节点和连线 -->
</svg>
```

---

## 渲染脚本（render.mjs）

每次渲染时在图片所在目录临时创建，用完删除：

```js
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
```

运行：`node render.mjs arch.svg session.svg sandbox.svg`

---

## 自检清单

- [ ] 判断逻辑是否都用了菱形 `<polygon>`？
- [ ] 所有连接是否都用了 `<line>` / `<path>` + `marker-end`？没有文字箭头 `↓` `→`？
- [ ] 主流程节点中心是否在同一条竖直线上？
- [ ] 并列节点是否在同一水平线上？
- [ ] 分支标注(Yes/No)是否不遮挡节点？
- [ ] 连线是否不穿越任何节点？
- [ ] 渲染后的 PNG 是否清晰（deviceScaleFactor: 2）？
- [ ] 临时文件（.svg、render.mjs）是否已删除？

## 参考文件

- 风格基准：`source/_posts/ai-agent-skill-2/flow.svg`
- 示例成品：`source/_posts/ai-agent-final/*.png`
