# Markdown 转微信公众号格式工具

## 功能特点

- ✅ 无需安装额外依赖
- ✅ 三种精美主题可选
- ✅ 一键复制到剪贴板
- ✅ **API 自动上传到草稿箱**（新增）
- ✅ 本地预览效果
- ✅ 支持常用 Markdown 语法
- ✅ 简洁的代码块样式
- ✅ 渐变色装饰标题

## 主题预览

### 🟣 Purple - 紫色渐变（默认）
- 现代优雅的紫色渐变风格
- 二级标题渐变背景
- macOS 风格代码块
- 适合科技、教程类文章

### 🔵 Blue - 蓝色简约
- 清新专业的蓝色调
- 简约边框装饰
- 清晰的视觉层次
- 适合正式、商务类文章

### 🟠 Orange - 橙色活力
- 温暖醒目的橙色系
- 活力十足的配色
- 暗色代码主题
- 适合生活、创意类文章

## 使用方法

### 方式一：使用 npm script（推荐）

```bash
# 使用默认主题（紫色）
npm run wechat source/_posts/ai-spec-driven-dev.md

# 指定主题
npm run wechat source/_posts/ai-spec-driven-dev.md -- --theme=blue
npm run wechat source/_posts/ai-spec-driven-dev.md -- --theme=orange
```

### 方式二：直接运行脚本

```bash
# 默认紫色主题
node scripts/md2wechat.js source/_posts/your-article.md

# 蓝色主题
node scripts/md2wechat.js source/_posts/your-article.md --theme=blue

# 橙色主题
node scripts/md2wechat.js source/_posts/your-article.md --theme=orange

# 指定输出文件
node scripts/md2wechat.js source/_posts/your-article.md output.html --theme=purple
```

## 转换流程

### 方式一：手动复制粘贴

1. **运行脚本**
   ```bash
   npm run wechat source/_posts/ai-spec-driven-dev.md
   ```

   生成的文件会自动保存到 `scripts/output/` 目录

2. **用浏览器打开生成的 HTML 文件**
   - 文件位置：`scripts/output/ai-spec-driven-dev-wechat.html`
   - 双击打开，或者拖拽到浏览器

3. **复制内容**
   - 打开浏览器开发者工具（F12）
   - 在 Console 控制台输入：`copyContent()`
   - 按回车，内容自动复制到剪贴板

4. **粘贴到微信公众号**
   - 进入微信公众号编辑器
   - 直接粘贴（Cmd+V / Ctrl+V）
   - 样式会自动保留

### 方式二：API 自动上传（推荐）

1. **配置微信公众号凭证**（首次使用）
   ```bash
   cp scripts/wechat-config.json.example scripts/wechat-config.json
   # 编辑 wechat-config.json，填入你的 appid 和 secret
   ```

2. **转换并上传**
   ```bash
   # 转换
   npm run wechat source/_posts/ai-spec-driven-dev.md

   # 上传到草稿箱
   npm run wechat-upload scripts/output/ai-spec-driven-dev-wechat.html
   ```

3. **在公众号后台发布**
   - 登录微信公众平台
   - 进入「素材管理」>「草稿箱」
   - 找到草稿，编辑并发布

**详细配置说明：** 查看 [WECHAT_API.md](./WECHAT_API.md)

## 输出目录

所有转换后的文件都保存在 `scripts/output/` 目录：
- ✅ 该目录已加入 `.gitignore`，不会提交到 Git
- ✅ 自动创建，无需手动创建
- ✅ 文件命名格式：`{原文件名}-wechat.html`

## 注意事项

### 图片处理

脚本会自动识别图片：
- ✅ **外链图片**（http/https）：直接支持
- ⚠️ **本地图片**：需要手动处理

**本地图片解决方案：**

1. **方案一：上传到公众号**
   - 在公众号编辑器中上传图片
   - 手动替换

2. **方案二：使用图床**
   - 上传到图床（如七牛云、阿里云 OSS）
   - 修改 Markdown 中的图片链接为 CDN 地址
   - 重新运行转换脚本

### 支持的 Markdown 语法

- ✅ 标题（H1-H3）
- ✅ 粗体、斜体
- ✅ 代码块和行内代码
- ✅ 引用
- ✅ 有序/无序列表
- ✅ 链接
- ✅ 图片
- ✅ 分割线

### 样式说明

已针对微信公众号优化：
- 标题有颜色和边框
- 代码块有背景色
- 链接有下划线
- 字号和行距适合阅读
- 移动端友好

## 自定义样式

有三种方式自定义样式：

### 方式一：选择预设主题（推荐）

直接使用 `--theme` 参数选择三个预设主题之一：
- `purple` - 紫色渐变（默认）
- `blue` - 蓝色简约
- `orange` - 橙色活力

### 方式二：修改现有主题

编辑 `scripts/styles/` 目录下的 CSS 文件：
- `purple.css` - 紫色渐变主题
- `blue.css` - 蓝色简约主题
- `orange.css` - 橙色活力主题

### 方式三：创建新主题

1. 在 `scripts/styles/` 目录下创建新的 CSS 文件，如 `green.css`
2. 在 `scripts/md2wechat.js` 中的 `THEMES` 对象添加：
   ```javascript
   const THEMES = {
     purple: 'purple.css',
     blue: 'blue.css',
     orange: 'orange.css',
     green: 'green.css'  // 新增
   };
   ```
3. 使用新主题：
   ```bash
   node scripts/md2wechat.js your-article.md --theme=green
   ```

## 常见问题

**Q: 为什么图片显示不出来？**
A: 本地图片需要上传到公众号或图床，使用 http(s) 链接

**Q: 复制后格式丢失怎么办？**
A: 确保使用 Chrome/Edge/Safari 等现代浏览器，避免使用 IE

**Q: 代码高亮能保留吗？**
A: 微信公众号不支持代码高亮，但保留了代码块的背景和缩进

## 批量转换

创建批量转换脚本：

```bash
#!/bin/bash
# batch-convert.sh

for file in source/_posts/*.md; do
  echo "转换: $file"
  npm run wechat "$file"
done
```

运行：
```bash
chmod +x batch-convert.sh
./batch-convert.sh
```

## 更新日志

- **v2.0** - 新增三种主题支持，优化样式和用户体验
  - 新增紫色渐变主题（默认）
  - 新增蓝色简约主题
  - 新增橙色活力主题
  - macOS 风格代码块
  - 响应式设计优化

- **v1.0** - 初始版本，支持基础 Markdown 语法

## 参考资源

如需更多样式灵感，可参考：
- [Markdown Nice](https://mdnice.com) - 在线编辑器
- [Md2All](http://md.aclickall.com) - 在线转换工具
