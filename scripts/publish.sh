#!/bin/bash
# 一键转换并上传到微信公众号
# 使用方式：./scripts/publish.sh source/_posts/your-article.md [theme]

set -e  # 遇到错误立即退出

if [ -z "$1" ]; then
  echo "❌ 请指定要转换的 Markdown 文件"
  echo ""
  echo "使用方式："
  echo "  ./scripts/publish.sh source/_posts/your-article.md [purple|blue|orange]"
  echo ""
  echo "示例："
  echo "  ./scripts/publish.sh source/_posts/ai-spec-driven-dev.md"
  echo "  ./scripts/publish.sh source/_posts/ai-spec-driven-dev.md blue"
  exit 1
fi

MD_FILE="$1"
THEME="${2:-purple}"

echo "🚀 开始处理: $MD_FILE"
echo "🎨 使用主题: $THEME"
echo ""

# 1. 转换为 HTML
echo "📝 步骤 1/2: 转换 Markdown 为 HTML..."
if [ "$THEME" = "purple" ]; then
  npm run wechat "$MD_FILE"
else
  npm run wechat "$MD_FILE" -- --theme="$THEME"
fi

# 获取生成的 HTML 文件名
BASENAME=$(basename "$MD_FILE" .md)
HTML_FILE="scripts/output/${BASENAME}-wechat.html"

echo ""
echo "✅ HTML 文件已生成: $HTML_FILE"
echo ""

# 2. 询问是否上传
read -p "是否上传到微信公众号草稿箱？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📤 步骤 2/2: 上传到微信公众号..."
  npm run wechat-upload "$HTML_FILE"
else
  echo "⏭️  跳过上传，你可以稍后手动上传："
  echo "   npm run wechat-upload $HTML_FILE"
  echo ""
  echo "或者手动复制粘贴："
  echo "   1. 用浏览器打开 $HTML_FILE"
  echo "   2. 按 F12，在控制台输入 copyContent()"
  echo "   3. 粘贴到微信公众号编辑器"
fi

echo ""
echo "✨ 完成！"
