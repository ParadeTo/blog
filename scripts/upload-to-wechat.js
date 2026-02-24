#!/usr/bin/env node
/**
 * 微信公众号草稿自动上传工具
 * 使用方式：
 *   node scripts/upload-to-wechat.js <html-file> [--title="文章标题"]
 *
 * 示例：
 *   node scripts/upload-to-wechat.js scripts/output/ai-spec-driven-dev-wechat.html
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'wechat-config.json');

// 读取配置
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ 配置文件不存在，请先创建 scripts/wechat-config.json');
    console.log('\n📝 配置文件模板：');
    console.log(JSON.stringify({
      appid: 'your_appid',
      secret: 'your_secret',
      author: '作者名称',
      digest: '文章摘要（可选）'
    }, null, 2));
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

  if (!config.appid || !config.secret) {
    console.error('❌ 配置文件缺少 appid 或 secret');
    process.exit(1);
  }

  return config;
}

// 获取 access_token
function getAccessToken(appid, secret) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error(`获取 access_token 失败: ${result.errmsg}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// 从 HTML 提取内容
function extractContent(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');

  // 提取 <section id="nice"> 中的内容（新格式）或 <div class="wechat-content">（旧格式）
  let contentMatch = html.match(/<section id="nice"[^>]*>([\s\S]*?)<\/section>/);
  if (!contentMatch) {
    contentMatch = html.match(/<div class="wechat-content">([\s\S]*?)<\/div>/);
  }

  if (!contentMatch) {
    throw new Error('无法从 HTML 文件中提取内容');
  }

  let content = contentMatch[1].trim();

  // 提取标题（第一个 h1，需要处理新格式中的 span）
  let titleMatch = content.match(/<h1[^>]*>[\s\S]*?<span class="content"[^>]*>(.*?)<\/span>[\s\S]*?<\/h1>/);
  if (!titleMatch) {
    titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
  }
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : path.basename(htmlFile, '-wechat.html');

  // 提取摘要（第一个段落）
  const digestMatch = content.match(/<p[^>]*>(.*?)<\/p>/);
  const digest = digestMatch ? digestMatch[1].replace(/<[^>]+>/g, '').substring(0, 120) : '';

  // 内容已经包含内联样式，直接返回整个 section
  const sectionMatch = html.match(/<section id="nice"[^>]*>[\s\S]*?<\/section>/);
  if (sectionMatch) {
    content = sectionMatch[0];
  }

  return { title, content, digest };
}

// 创建草稿
function createDraft(accessToken, articles) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ articles });

    const options = {
      hostname: 'api.weixin.qq.com',
      path: `/cgi-bin/draft/add?access_token=${accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errcode === 0 || result.media_id) {
            resolve(result);
          } else {
            reject(new Error(`创建草稿失败: ${result.errmsg} (errcode: ${result.errcode})`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('使用方法：');
    console.log('  node scripts/upload-to-wechat.js <html-file>');
    console.log('\n示例：');
    console.log('  node scripts/upload-to-wechat.js scripts/output/ai-spec-driven-dev-wechat.html');
    console.log('\n说明：');
    console.log('  1. 首次使用需要创建 scripts/wechat-config.json 配置文件');
    console.log('  2. 配置文件需要包含 appid 和 secret');
    console.log('  3. 可以在微信公众平台获取：设置与开发 > 基本配置');
    process.exit(0);
  }

  const htmlFile = args[0];

  if (!fs.existsSync(htmlFile)) {
    console.error(`❌ 文件不存在: ${htmlFile}`);
    process.exit(1);
  }

  console.log('🚀 开始上传到微信公众号...\n');

  try {
    // 1. 读取配置
    console.log('📖 读取配置文件...');
    const config = loadConfig();

    // 2. 获取 access_token
    console.log('🔑 获取 access_token...');
    const accessToken = await getAccessToken(config.appid, config.secret);
    console.log('✅ access_token 获取成功\n');

    // 3. 提取内容
    console.log('📝 提取文章内容...');
    const { title, content, digest } = extractContent(htmlFile);
    console.log(`📄 标题: ${title}`);
    console.log(`📝 摘要: ${digest.substring(0, 50)}...`);

    // 4. 创建草稿
    console.log('\n📤 正在创建草稿...');
    const article = {
      title: title,
      author: config.author || '',
      digest: digest || config.digest || '',
      content: content,
      content_source_url: config.content_source_url || '', // 原文链接
      need_open_comment: config.need_open_comment || 0, // 是否打开评论
      only_fans_can_comment: config.only_fans_can_comment || 0 // 是否只有粉丝可以评论
    };

    // 如果配置了封面图片 media_id，则添加
    if (config.thumb_media_id) {
      article.thumb_media_id = config.thumb_media_id;
    }

    const result = await createDraft(accessToken, [article]);

    console.log('\n✅ 草稿创建成功！');
    console.log(`📦 Media ID: ${result.media_id}`);
    console.log('\n💡 下一步：');
    console.log('1. 登录微信公众平台：https://mp.weixin.qq.com');
    console.log('2. 进入「素材管理」>「草稿箱」');
    console.log('3. 找到刚才创建的草稿进行编辑和发布');

  } catch (error) {
    console.error('\n❌ 上传失败：', error.message);
    console.log('\n💡 常见问题：');
    console.log('1. 检查 appid 和 secret 是否正确');
    console.log('2. 检查公众号是否有权限调用草稿接口（需要认证）');
    console.log('3. 检查网络连接是否正常');
    process.exit(1);
  }
}

main();
