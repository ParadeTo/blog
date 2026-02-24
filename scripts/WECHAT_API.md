# 微信公众号草稿自动上传指南

## 🎯 功能说明

自动将转换后的 HTML 文章上传到微信公众号草稿箱，无需手动复制粘贴。

## 📋 前置准备

### 1. 获取微信公众号开发者凭证

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入「设置与开发」>「基本配置」
3. 获取以下信息：
   - **AppID**（开发者ID）
   - **AppSecret**（开发者密码）

⚠️ **重要提示：**
- 只有**已认证**的服务号和订阅号才能使用草稿接口
- AppSecret 非常重要，请妥善保管，不要泄露

### 2. 创建配置文件

复制示例配置文件并填写你的信息：

```bash
cp scripts/wechat-config.json.example scripts/wechat-config.json
```

编辑 `scripts/wechat-config.json`：

```json
{
  "appid": "wx1234567890abcdef",
  "secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "author": "张三",
  "digest": "这是文章摘要（可选）"
}
```

配置说明：
- `appid`: 你的微信公众号 AppID（必填）
- `secret`: 你的微信公众号 AppSecret（必填）
- `author`: 文章作者名称（选填）
- `digest`: 默认文章摘要（选填，不填则自动提取第一段）

⚠️ **安全提示：**
- `wechat-config.json` 已加入 `.gitignore`，不会被提交到 Git
- 请勿将此文件分享给他人

## 🚀 使用方法

### 完整流程

1. **转换 Markdown 为 HTML**
   ```bash
   npm run wechat source/_posts/ai-spec-driven-dev.md
   ```

2. **上传到微信公众号草稿箱**
   ```bash
   npm run wechat-upload scripts/output/ai-spec-driven-dev-wechat.html
   ```

3. **在公众号后台编辑和发布**
   - 登录微信公众平台
   - 进入「素材管理」>「草稿箱」
   - 找到刚才上传的草稿
   - 编辑、预览、发布

### 一键操作（推荐）

```bash
# 1. 转换
npm run wechat source/_posts/your-article.md

# 2. 上传
npm run wechat-upload scripts/output/your-article-wechat.html
```

### 指定主题

```bash
# 使用蓝色主题
npm run wechat source/_posts/your-article.md -- --theme=blue

# 上传
npm run wechat-upload scripts/output/your-article-wechat.html
```

## ✅ 上传成功示例

```
🚀 开始上传到微信公众号...

📖 读取配置文件...
🔑 获取 access_token...
✅ access_token 获取成功

📝 提取文章内容...
📄 标题: SDD（Spec Driven Development）规范驱动开发实践
📝 摘要: 探索规范驱动开发（Spec-Driven Development）如何改变传统软件开发流程...

📤 正在创建草稿...

✅ 草稿创建成功！
📦 Media ID: xxx_xxx_xxx

💡 下一步：
1. 登录微信公众平台：https://mp.weixin.qq.com
2. 进入「素材管理」>「草稿箱」
3. 找到刚才创建的草稿进行编辑和发布
```

## ❌ 常见问题

### 1. 获取 access_token 失败

**错误信息：**
```
❌ 获取 access_token 失败: invalid appid
```

**解决方案：**
- 检查 `wechat-config.json` 中的 `appid` 是否正确
- 确保复制时没有多余的空格

### 2. 创建草稿失败 - 无权限

**错误信息：**
```
❌ 创建草稿失败: api unauthorized (errcode: 48001)
```

**解决方案：**
- 确保公众号已认证（未认证的订阅号无法使用草稿接口）
- 检查接口权限是否开通

### 3. 创建草稿失败 - 参数错误

**错误信息：**
```
❌ 创建草稿失败: invalid parameter (errcode: 40035)
```

**解决方案：**
- 检查文章内容是否包含敏感词
- 检查图片链接是否有效（必须是 http/https）
- 确保文章标题不为空

### 4. 图片显示不出来

**原因：**
微信公众号不支持外链图片，需要先上传到微信服务器

**解决方案：**
- 方案一：在草稿箱中手动上传替换图片
- 方案二：先将图片上传到微信素材库，获取 media_id，然后在 HTML 中使用

## 🔐 安全建议

1. **不要提交配置文件到 Git**
   - `wechat-config.json` 已加入 `.gitignore`
   - 包含敏感的 AppSecret，切勿分享

2. **定期更换 AppSecret**
   - 如果怀疑泄露，立即在公众平台重置

3. **权限最小化**
   - 如果有团队成员，考虑使用子账号
   - 限制不必要的接口权限

## 📚 API 参考

- [微信公众号草稿箱接口文档](https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html)
- [获取 Access Token](https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html)

## 🎨 高级用法

### 批量上传

创建批量上传脚本 `batch-upload.sh`：

```bash
#!/bin/bash

# 转换所有文章
for file in source/_posts/*.md; do
  npm run wechat "$file"
done

# 上传所有 HTML
for file in scripts/output/*.html; do
  npm run wechat-upload "$file"
  sleep 2  # 避免频率限制
done
```

### 自动化工作流

结合 CI/CD 实现自动发布：

```yaml
# .github/workflows/publish.yml
name: Publish to WeChat

on:
  push:
    paths:
      - 'source/_posts/*.md'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Convert and Upload
        env:
          WECHAT_APPID: ${{ secrets.WECHAT_APPID }}
          WECHAT_SECRET: ${{ secrets.WECHAT_SECRET }}
        run: |
          npm run wechat source/_posts/latest.md
          npm run wechat-upload scripts/output/latest-wechat.html
```

## 💡 提示

- 草稿不会自动发布，需要在公众号后台手动发布
- 建议先在草稿箱预览效果，调整后再发布
- 图片建议提前上传到微信素材库
- 可以在草稿箱中继续编辑样式和排版
