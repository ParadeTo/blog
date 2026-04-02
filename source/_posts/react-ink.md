---
title: 用 React 写 CLI？React Ink 源码浅析
date: 2026-04-02 10:00:00
tags:
  - react
  - cli
  - nodejs
categories:
  - frontend
description: Claude Code 的终端 UI 是用 React 写的，背后是一个叫 Ink 的库。本文介绍 Ink 的用法，并浅析它的核心实现原理。
---

# 前言

用过 Claude Code 的同学应该都注意到，它的终端界面相当精致——输入框、加载动画、对话气泡，甚至还有颜色高亮和布局对齐。第一次看到的时候我就在想：这是怎么做到的？

翻了下 Claude Code 的技术栈，发现它用的是一个叫 **[Ink](https://github.com/vadimdemedes/ink)** 的库。Ink 的口号很简单：**React for CLIs**。没错，就是用写网页的那套 React 组件化思路，来构建命令行界面。

目前 Ink 在 GitHub 上有 **36.7k stars**，除了 Claude Code，Gemini CLI、GitHub Copilot CLI、Cloudflare Wrangler 都在用它。这篇文章就来看看 Ink 到底是什么，怎么用，以及它的核心原理是什么。

# 一、Ink 是什么

Ink 是一个 **自定义 React 渲染器（Custom Renderer）**，它把 React 的组件模型移植到了命令行环境中。

普通的 React 渲染到 DOM，React Native 渲染到原生控件，而 Ink 渲染到**终端的字符流**。你写的每一个 `<Box>`、`<Text>` 组件，最终都会被转换成 ANSI 转义序列输出到 stdout。

谁在用它（截取自 [README](https://github.com/vadimdemedes/ink/tree/master)）：

- **[Claude Code](https://github.com/anthropics/claude-code)** — Anthropic 的 AI 编码工具
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** — Google 的 AI 编码工具
- **[GitHub Copilot CLI](https://github.com/features/copilot/cli)**
- **[Cloudflare Wrangler](https://github.com/cloudflare/wrangler2)**
- **[Shopify CLI](https://github.com/Shopify/cli)**

可以说，但凡追求交互体验的现代 CLI 工具，大概率都在考虑 Ink。

# 二、快速上手

安装：

```bash
npm install ink react
```

先上效果——一个实时更新的 Build Pipeline 进度看板：

![](./react-ink/1.png)

代码如下：

```tsx
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';

type Task = { label: string; progress: number; color: string };

const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// 进度条组件：█ 填充 + ░ 空格 + 百分比
const Bar = ({ value, color }: { value: number; color: string }) => {
  const filled = Math.round(value / 5);
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(20 - filled)}</Text>
      <Text color="white"> {String(value).padStart(3)}%</Text>
    </Text>
  );
};

const Pipeline = () => {
  const [tick, setTick] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([
    { label: 'Install deps ', progress: 0, color: 'cyan' },
    { label: 'Type check   ', progress: 0, color: 'blue' },
    { label: 'Run tests    ', progress: 0, color: 'yellow' },
    { label: 'Build & Ship ', progress: 0, color: 'green' },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setTasks(prev =>
        prev.map((t, i) => ({
          ...t,
          progress: Math.min(100, t.progress + [5, 3, 2, 1][i]),
        }))
      );
    }, 80);
    return () => clearInterval(id);
  }, []);

  const done = tasks.every(t => t.progress === 100);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box marginBottom={1} gap={1}>
        <Text bold color="cyan">▶ Build Pipeline</Text>
        <Text color="gray">{done ? '✓ done' : SPINNERS[tick % 10]}</Text>
      </Box>
      {tasks.map(t => (
        <Box key={t.label} gap={1}>
          <Text color={t.progress === 100 ? 'green' : 'white'}>
            {t.progress === 100 ? '✓' : '·'} {t.label}
          </Text>
          <Bar value={t.progress} color={t.color} />
        </Box>
      ))}
    </Box>
  );
};

render(<Pipeline />);
```

是不是比想象中强？几十行代码就出了一个带边框、多色进度条、实时 spinner 的终端 UI。`useState`、`useEffect` 全部照用，`<Box>` 对标 `<div>`，Flexbox 布局直接搬过来，唯一的区别是渲染目标从浏览器 DOM 变成了终端字符流。

用 `create-ink-app` 可以快速脚手架一个项目：

```bash
npx create-ink-app my-cli
# TypeScript 版本
npx create-ink-app --typescript my-cli
```

# 三、核心 API

## 3.1 `<Text>` 组件

`<Text>` 是 Ink 中输出文本的唯一方式，支持颜色、样式等属性：

```tsx
import { render, Text } from 'ink';

const Demo = () => (
  <>
    <Text color="green">绿色文字</Text>
    <Text color="#005cc5" bold>蓝色加粗</Text>
    <Text backgroundColor="white" color="black">黑底白字</Text>
    <Text italic underline>斜体下划线</Text>
    <Text strikethrough>删除线</Text>
  </>
);

render(<Demo />);
```

颜色底层用的是 [chalk](https://github.com/chalk/chalk)，支持所有 chalk 格式：颜色名、hex、rgb 都可以。

> 注意：`<Text>` 内部只能嵌套文本节点或其他 `<Text>`，不能放 `<Box>`。

## 3.2 `<Box>` 与 Flexbox 布局

`<Box>` 是 Ink 的布局容器，对标 HTML 的 `<div>`。Ink 内置了 **[Yoga](https://github.com/facebook/yoga)** 这个 Flexbox 布局引擎（Facebook 开源，React Native 也在用），所以你可以直接用 CSS Flexbox 的思路写布局：

```tsx
import { render, Box, Text } from 'ink';

const Layout = () => (
  <Box flexDirection="row" gap={2}>
    <Box flexDirection="column" width={20}>
      <Text bold>左侧菜单</Text>
      <Text>- 选项一</Text>
      <Text>- 选项二</Text>
    </Box>
    <Box flexGrow={1} borderStyle="round" padding={1}>
      <Text>右侧内容区域</Text>
    </Box>
  </Box>
);

render(<Layout />);
```

常用的 Flexbox 属性（`flexDirection`、`flexGrow`、`alignItems`、`justifyContent`、`gap`、`padding`、`margin`、`width`、`height`）基本都支持。每个 `<Box>` 默认就是 `display: flex`。

## 3.3 常用 Hooks

**`useInput`** — 监听键盘输入：

```tsx
import { useInput, render, Text } from 'ink';
import { useState } from 'react';

const App = () => {
  const [key, setKey] = useState('');

  useInput((input, key) => {
    if (key.escape) process.exit();
    setKey(input);
  });

  return <Text>你按了：{key}（按 ESC 退出）</Text>;
};

render(<App />);
```

**`useApp`** — 控制应用生命周期：

```tsx
import { useApp, render, Text } from 'ink';
import { useEffect } from 'react';

const App = () => {
  const { exit } = useApp();

  useEffect(() => {
    // 3 秒后自动退出
    setTimeout(exit, 3000);
  }, []);

  return <Text>3 秒后自动退出...</Text>;
};

render(<App />);
```

其他常用 Hook 还有：`useStdin`、`useStdout`、`useWindowSize`（监听终端窗口大小变化）、`useFocus`（焦点管理）等。

# 四、它是怎么工作的

这部分是源码层面的分析，看看 Ink 的核心架构。整体流程分四步：

```
React 组件树
    ↓  (react-reconciler)
虚拟 DOM（ink-box / ink-text 节点）
    ↓  (Yoga 计算 Flexbox 布局)
带坐标的布局结果
    ↓  (render-to-string)
ANSI 字符串 → stdout
```

## 4.1 自定义 React Reconciler

Ink 的核心是 `src/reconciler.ts`，它用 `react-reconciler` 包实现了一个自定义渲染器：

```typescript
import createReconciler from 'react-reconciler';
import Yoga from 'yoga-layout';
import {
  createNode,
  createTextNode,
  appendChildNode,
  // ...
} from './dom.js';

const reconciler = createReconciler({
  createInstance(type, props) {
    // 把 React 组件映射到 Ink 的虚拟 DOM 节点
    const node = createNode(type);
    // ...
    return node;
  },
  appendChild(parentInstance, child) {
    appendChildNode(parentInstance, child);
  },
  // ...
});
```

`react-reconciler` 是 React 官方提供的底层包，React DOM 和 React Native 都是基于它实现的。你只需要实现一套"宿主环境"的 API（怎么创建节点、怎么插入节点、怎么更新属性等），React 的 diff 和调度逻辑就全部复用了。

## 4.2 虚拟 DOM

Ink 有自己的一套虚拟 DOM，定义在 `src/dom.ts`：

```typescript
export type ElementNames =
  | 'ink-root'
  | 'ink-box'
  | 'ink-text'
  | 'ink-virtual-text';

export type DOMElement = {
  nodeName: ElementNames;
  attributes: Record<string, DOMNodeAttribute>;
  childNodes: DOMNode[];
  yogaNode?: YogaNode;  // 对应 Yoga 布局节点
  style: Styles;
  // ...
};
```

你写的 `<Box>` 对应 `ink-box` 节点，`<Text>` 对应 `ink-text` 节点。每个节点都挂了一个 **Yoga 节点**（`yogaNode`），这是 Flexbox 布局计算的基础。

## 4.3 Yoga 布局计算

Yoga 是 Facebook 开源的跨平台 Flexbox 实现，React Native 也用它。Ink 把每个 DOM 节点的 `flexDirection`、`padding`、`width` 等属性同步给对应的 Yoga 节点，然后调用 Yoga 的 `calculateLayout()` 来计算出每个节点的精确位置和尺寸。

这就是为什么你能在终端里用 CSS Flexbox 布局——本质上 Yoga 给你做了完整的盒模型计算。

## 4.4 渲染成字符串

布局算好之后，`src/renderer.ts` 把虚拟 DOM 树渲染成字符串：

```typescript
const renderer = (node: DOMElement): Result => {
  const output = new Output({
    width: node.yogaNode.getComputedWidth(),
    height: node.yogaNode.getComputedHeight(),
  });

  renderNodeToOutput(node, output, { skipStaticElements: true });

  const { output: generatedOutput, height: outputHeight } = output.get();
  return { output: generatedOutput, outputHeight, staticOutput };
};
```

`Output` 是一个二维字符缓冲区，每个位置存一个字符（加上 ANSI 颜色码）。`renderNodeToOutput` 递归遍历节点树，根据 Yoga 计算好的坐标把每个节点的内容"画"到缓冲区里，最后一次性 flush 到终端。

## 4.5 终端输出与更新

Ink 用了 `log-update` 的思路来实现"原地刷新"——每次重渲染时，先用 ANSI 转义码清除上一帧的内容，再输出新内容，从而实现动画效果。

主类 `src/ink.tsx` 负责把以上所有环节串起来，同时处理：
- 终端窗口大小变化（重新计算布局）
- CI 环境检测（`is-in-ci`，CI 里不刷新直接输出）
- 信号处理（`signal-exit`，优雅退出时恢复光标）
- 无障碍支持（screen reader 输出）

# 五、总结

Ink 做的事情本质上是：**把 React 的组件模型接到终端这个"宿主环境"上**。技术上，它实现了一个自定义 React Reconciler，把 React 组件树翻译成内部虚拟 DOM，再用 Yoga 做 Flexbox 布局计算，最终渲染成 ANSI 字符串输出到终端。

它适合什么场景？

- 交互式 CLI 工具（带输入、菜单、进度条）
- 需要复杂布局的终端 UI（多列、嵌套）
- 团队已经熟悉 React，希望复用同一套思维模型

和传统 CLI 库（chalk + inquirer）相比，Ink 的优势是**组件化和状态管理**——UI 逻辑和状态都在组件里，复杂界面拆成小组件，比一堆命令式代码好维护得多。代价是有一定的学习曲线，以及 Node.js 里跑 React 的额外开销。

如果你要写一个功能简单的 CLI，chalk + inquirer 够用。但如果你在做 Claude Code 这种复杂的交互式工具，Ink 几乎是目前最好的选择。
