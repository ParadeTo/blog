const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv[2] || 'https://time.geekbang.org/course/detail/101114301-972263';
const OUTPUT_DIR = process.argv[3] || '/Users/youxingzhi/ayou/blog/idea/xiaoquan-team';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '-').substring(0, 80);
}

async function extractContent(page) {
  return page.evaluate(() => {
    // 极客时间课程页面内容提取
    const titleEl = document.querySelector('h1, .article-title, [class*="title"]');
    const title = titleEl ? titleEl.innerText.trim() : document.title;

    // 尝试找到正文区域
    const selectors = [
      '[class*="article-content"]',
      '[class*="content-wrapper"]',
      '[class*="markdown"]',
      '[class*="article"]',
      'article',
      '[class*="intro"]',
      '[class*="detail"]',
    ];

    let content = '';
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        content = el.innerText.trim();
        break;
      }
    }

    // 如果没找到特定区域，取 body 文本
    if (!content) {
      content = document.body.innerText.trim();
    }

    return { title, content };
  });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('启动浏览器（非 headless，请在浏览器中登录极客时间后按回车继续）...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log(`\n导航到: ${TARGET_URL}`);
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log('导航超时，继续...');
  }

  await sleep(3000);

  // 检查是否需要登录
  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('passport')) {
    console.log('\n需要登录，请在浏览器中完成登录，等待 30 秒后自动继续...');
    await sleep(30000);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
  } else {
    console.log('已登录，5 秒后自动继续...');
    await sleep(5000);
  }

  // 点击展开按钮
  try {
    const expandBtn = page.locator('text=展开').first();
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await sleep(1000);
    }
  } catch (e) {}

  // 滚动加载全部内容
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(200);
  }
  await sleep(2000);

  const { title, content } = await extractContent(page);
  console.log(`\n标题: ${title}`);
  console.log(`内容长度: ${content.length} 字符`);

  // 提取课时 ID 作为文件名前缀
  const lessonId = TARGET_URL.match(/\d+$/) ? TARGET_URL.match(/(\d+)$/)[1] : 'unknown';
  const filename = `${lessonId}-${sanitizeFilename(title)}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const markdown = `# ${title}\n\n> 来源: ${TARGET_URL}\n\n${content}\n`;
  fs.writeFileSync(filepath, markdown, 'utf8');
  console.log(`\n已保存到: ${filepath}`);

  await sleep(2000);
  await browser.close();
  process.exit(0);
}

main().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
