# 🚀 快速开始

## 方式一：手动复制粘贴

### 一键转换

```bash
# 转换文章（使用默认紫色主题）
npm run wechat source/_posts/ai-spec-driven-dev.md
```

就这么简单！🎉

生成的文件在：`scripts/output/ai-spec-driven-dev-wechat.html`

### 发布到公众号

1. **打开生成的 HTML**
   - 用浏览器打开 `scripts/output/your-article-wechat.html`

2. **复制内容**
   - 按 F12 打开控制台
   - 输入：`copyContent()`
   - 按回车

3. **粘贴到公众号**
   - Cmd+V / Ctrl+V 直接粘贴
   - 完成！✨

## 方式二：API 自动上传（推荐）⭐

### 首次配置（仅需一次）

```bash
# 1. 复制配置模板
cp scripts/wechat-config.json.example scripts/wechat-config.json

# 2. 编辑配置文件，填入你的微信公众号信息
# appid 和 secret 从微信公众平台获取：设置与开发 > 基本配置
```

### 转换并上传

```bash
# 1. 转换文章
npm run wechat source/_posts/ai-spec-driven-dev.md

# 2. 上传到草稿箱
npm run wechat-upload scripts/output/ai-spec-driven-dev-wechat.html

# 3. 登录公众号后台，在草稿箱找到文章，编辑并发布
```

**就这么简单！** 🎊

### 详细配置指南

查看 [WECHAT_API.md](./WECHAT_API.md) 了解：
- 如何获取 appid 和 secret
- 常见问题解决方案
- 高级用法和批量上传

## 选择主题

```bash
# 蓝色简约主题
npm run wechat source/_posts/ai-spec-driven-dev.md -- --theme=blue

# 橙色活力主题
npm run wechat source/_posts/ai-spec-driven-dev.md -- --theme=orange
```

## 查看主题预览

用浏览器打开：`scripts/theme-preview.html`

## 发布到公众号

1. **打开生成的 HTML**
   - 用浏览器打开 `scripts/output/your-article-wechat.html`

2. **复制内容**
   - 按 F12 打开控制台
   - 输入：`copyContent()`
   - 按回车

3. **粘贴到公众号**
   - Cmd+V / Ctrl+V 直接粘贴
   - 完成！✨

## 输出目录说明

📁 所有生成的文件都在 `scripts/output/` 目录
- ✅ 已加入 `.gitignore`，不会提交到 Git
- ✅ 自动创建，无需手动处理
- ✅ 可以随时删除重新生成

## 常见问题

**Q: 图片显示不出来？**
```
本地图片需要先上传到图床或公众号
推荐使用：
- 七牛云
- 阿里云 OSS
- 微信公众号图片管理
```

**Q: 想要自定义颜色？**
```
编辑 scripts/styles/ 目录下的 CSS 文件
或者创建自己的主题
```

## 详细文档

查看 `scripts/README.md` 了解更多功能
