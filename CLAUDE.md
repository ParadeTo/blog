# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chinese-language technical blog (www.paradeto.com) built with **Hexo 3.7** using the **NexT** theme. Contains 400+ posts covering frontend, backend (Go, Node.js), algorithms, ML, and DevOps. The blog author goes by "Ayou".

## Commands

```bash
# Development server (default port 4000)
npx hexo server

# Generate static files
npx hexo generate

# Create a new post (creates source/_posts/<title>.md with asset folder)
npx hexo new "<title>"

# Clean generated files
npx hexo clean

# Deploy to GitHub Pages + Coding (pushes to remote repos)
npx hexo deploy

# Full rebuild and deploy
npx hexo clean && npx hexo generate && npx hexo deploy
```

### WeChat Publishing Pipeline

Converts blog posts to styled HTML for WeChat Official Account (WeChat public platform):

```bash
# One-step: convert + upload (interactive)
./scripts/publish.sh source/_posts/article-name.md [purple|blue|orange]

# Convert only
npm run wechat source/_posts/article-name.md

# Upload converted HTML to WeChat drafts
npm run wechat-upload scripts/output/article-name-wechat.html
```

## Architecture

### Key Configuration

- `_config.yml` — Hexo config. `post_asset_folder: true` means each post gets a same-named directory for images/assets.
- `themes/next/_config.yml` — NexT theme config.
- `.nvmrc` — Node v10 (required by Hexo 3.x).

### Content Structure

- `source/_posts/` — All blog posts as Markdown with YAML front matter (`title`, `date`, `tags`).
- `source/_posts/<post-name>/` — Asset folders for post images (created automatically with `post_asset_folder: true`). Reference images in posts with just the filename, e.g., `![alt](image.png)`.
- `source/_drafts/` — Draft posts (not published).
- `scaffolds/post.md` — Template for new posts.
- `idea/` — Article ideas and planning docs (not part of Hexo build).

### Scripts (`scripts/`)

WeChat publishing toolchain:
- `md2wechat.js` — Markdown-to-styled-HTML converter with theme support (purple/blue/orange).
- `upload-to-wechat.js` — Uploads HTML to WeChat Official Account via API.
- `upload-image.js` — Uploads images to WeChat media library.
- `publish.sh` — One-click convert + upload workflow.
- `wechat-config.json` — WeChat API credentials (gitignored, copy from `.example`).

### Deployment

Git-based deploy to two remotes:
- GitHub Pages: `ParadeTo/ParadeTo.github.io` (master)
- Coding: `youxingzhi/youxingzhi` (master)

Custom domain: `www.paradeto.com` (configured via `source/CNAME`).

## Writing Conventions

- Blog language: Chinese (zh-CN).
- Front matter: `title`, `date`, `tags` (see `scaffolds/post.md`).
- Post filenames use kebab-case with topic prefixes (e.g., `react-optimize.md`, `algo-btree-1.md`, `go-slice1.md`).
- Images go in the post's asset folder and are referenced by filename only.
- Diagrams (flowcharts, architecture diagrams) must follow the `draw-diagram` skill (`.claude/skills/draw-diagram/SKILL.md`): hand-written SVG with diamond `<polygon>` for decisions, `<line>` + arrow markers for connections (never text arrows like `↓`), rendered to PNG via puppeteer-core.
