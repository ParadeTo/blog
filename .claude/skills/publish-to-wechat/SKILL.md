---
name: publish-to-wechat
description: 将博客文章发布到微信公众号草稿箱，包含图片处理和封面选择
---

# 微信公众号发布

将指定 markdown 文章一键发布为微信公众号草稿。

## 使用方式

用户说"发布到微信"、"发一下微信"或 `/publish-to-wechat` 时触发。
若用户没有指定文章路径，先询问要发布哪篇文章。

## 工作流程

### 第一步：读取文章信息

用 Read 工具读取 markdown 文件，提取：
- `title`：文章标题
- `description`：将用作微信摘要
- 正文中所有本地图片路径（`![](./xxx/yyy.png)` 格式）

### 第二步：转换 + 上传正文图片

```bash
node scripts/md2wechat.js <file>
```

该命令会：
- 将正文中的本地图片上传到微信素材库并替换 URL
- 生成含内联样式的 HTML 到 `scripts/output/`
- `description` 字段自动嵌入 HTML 的 `data-description`，upload 脚本会读取它作为摘要

### 第三步：确定封面图片（交互）

用 AskUserQuestion 询问封面来源，选项：

1. **正文图片** — 列出第一步扫描到的本地图片，让用户选择
2. **Claude 生成** — 根据文章主题生成一张封面图（参考 draw-diagram skill）
3. **不设封面** — 跳过

**如果选了图片（正文图片或生成图片）：**

```bash
node scripts/upload-image.js <图片路径>
```

从输出中提取 `Media ID: <id>`，记录为 `THUMB_MEDIA_ID`。

### 第四步：上传草稿

```bash
# 有封面
node scripts/upload-to-wechat.js scripts/output/<article>-wechat.html --thumb=<THUMB_MEDIA_ID>

# 无封面
node scripts/upload-to-wechat.js scripts/output/<article>-wechat.html
```

### 第五步：完成

告知用户草稿已创建，提示去微信公众平台草稿箱查看。

## 注意事项

- 图片上传需要 IP 白名单，若失败请让用户添加当前 IP 后再试
- `scripts/wechat-config.json` 需包含 `appid` 和 `secret`
- 封面图片大小不超过 2MB，格式支持 jpg/png/gif/bmp
- 正文中不以 `http` 开头的图片路径会被自动上传；路径是相对于 markdown 文件的
