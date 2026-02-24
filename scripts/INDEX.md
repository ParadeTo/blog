# 📚 微信公众号工具套件

将 Markdown 文章一键发布到微信公众号的完整工具链。

## 🎯 核心功能

1. **Markdown 转换** - 将 MD 转为微信公众号格式的 HTML
2. **主题切换** - 三种精美主题可选（紫/蓝/橙）
3. **API 上传** - 自动上传到公众号草稿箱
4. **一键发布** - 完整的自动化流程

## 🚀 快速开始

### 最简单的方式（一键发布）

```bash
# 转换并上传（会询问是否上传）
./scripts/publish.sh source/_posts/your-article.md

# 指定主题
./scripts/publish.sh source/_posts/your-article.md blue
```

### 分步执行

```bash
# 1. 转换
npm run wechat source/_posts/your-article.md

# 2. 上传（需要先配置 wechat-config.json）
npm run wechat-upload scripts/output/your-article-wechat.html
```

## 📖 文档目录

- **[QUICKSTART.md](./QUICKSTART.md)** - 5分钟快速入门
- **[README.md](./README.md)** - 完整功能说明和使用指南
- **[WECHAT_API.md](./WECHAT_API.md)** - 微信公众号 API 配置和使用
- **[theme-preview.html](./theme-preview.html)** - 主题预览页面（浏览器打开）

## 📂 文件结构

```
scripts/
├── md2wechat.js              # MD 转 HTML 脚本
├── upload-to-wechat.js       # 上传到微信公众号脚本
├── publish.sh                # 一键发布脚本
├── wechat-config.json        # 微信配置（需自己创建）
├── wechat-config.json.example # 配置模板
├── styles/                   # 主题样式目录
│   ├── purple.css           # 紫色渐变主题
│   ├── blue.css             # 蓝色简约主题
│   └── orange.css           # 橙色活力主题
├── output/                   # 输出目录（自动创建）
└── docs/                     # 文档目录
    ├── INDEX.md             # 本文件
    ├── QUICKSTART.md        # 快速开始
    ├── README.md            # 完整文档
    └── WECHAT_API.md        # API 文档
```

## 🎨 主题选择

| 主题 | 风格 | 适用场景 |
|------|------|----------|
| 🟣 Purple | 紫色渐变 | 科技、教程、产品 |
| 🔵 Blue | 蓝色简约 | 企业、商务、正式 |
| 🟠 Orange | 橙色活力 | 生活、创意、热点 |

## 💡 使用场景

### 场景一：个人博客发布

```bash
# Hexo 博客文章发布到公众号
./scripts/publish.sh source/_posts/latest-blog.md
```

### 场景二：团队协作

```bash
# 使用蓝色主题（正式文档）
./scripts/publish.sh docs/company-announcement.md blue

# 使用橙色主题（活动宣传）
./scripts/publish.sh marketing/event.md orange
```

### 场景三：批量发布

```bash
# 批量转换
for file in source/_posts/*.md; do
  npm run wechat "$file"
done

# 批量上传
for file in scripts/output/*.html; do
  npm run wechat-upload "$file"
  sleep 2  # 避免频率限制
done
```

## ⚙️ 配置说明

### 首次使用配置

1. **复制配置模板**
   ```bash
   cp scripts/wechat-config.json.example scripts/wechat-config.json
   ```

2. **填写微信公众号信息**
   - 登录 [微信公众平台](https://mp.weixin.qq.com)
   - 进入「设置与开发」>「基本配置」
   - 获取 AppID 和 AppSecret
   - 填入 `wechat-config.json`

3. **测试配置**
   ```bash
   npm run wechat-upload scripts/output/test-wechat.html
   ```

详细配置步骤查看 [WECHAT_API.md](./WECHAT_API.md)

## 🔧 命令参考

### npm scripts

```bash
# 转换 Markdown 为 HTML
npm run wechat <md-file> [-- --theme=<purple|blue|orange>]

# 上传 HTML 到微信公众号
npm run wechat-upload <html-file>
```

### 直接运行脚本

```bash
# 转换
node scripts/md2wechat.js <md-file> [output.html] [--theme=<theme>]

# 上传
node scripts/upload-to-wechat.js <html-file>

# 一键发布
./scripts/publish.sh <md-file> [theme]
```

## 🛡️ 安全提示

- ✅ `wechat-config.json` 已加入 `.gitignore`
- ✅ `scripts/output/` 目录已加入 `.gitignore`
- ⚠️ 切勿将 AppSecret 提交到 Git
- ⚠️ 切勿将配置文件分享给他人

## ❓ 常见问题

### Q: 上传失败怎么办？

A: 查看 [WECHAT_API.md](./WECHAT_API.md) 的「常见问题」章节

### Q: 图片显示不出来？

A: 本地图片需要先上传到图床或微信素材库，详见 README.md

### Q: 如何自定义样式？

A: 编辑 `scripts/styles/` 下的 CSS 文件，或创建新主题

### Q: 可以批量处理吗？

A: 可以，参考上面的「批量发布」示例

## 📈 更新日志

### v3.0 (当前版本)
- ✨ 新增微信公众号 API 自动上传
- ✨ 新增一键发布脚本
- ✨ 优化输出目录结构
- 🐛 简化代码块样式

### v2.0
- ✨ 新增三种主题支持
- ✨ 优化样式和用户体验
- ✨ 响应式设计优化

### v1.0
- 🎉 初始版本
- 基础 Markdown 转换功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**愉快地发布文章吧！** 🎉
