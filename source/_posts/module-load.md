---
title: script module 的执行时机
date: 2023-02-28 11:15:55
tags:
  - javascript
categories:
  - javascript
description: script module 的执行时机
---

`<script type="module" />` 行为默认同 `defer`，比如下面这个例子：

```js
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script type="module" src="./small.js"></script>
    <script src="./big4.js"></script>
  </head>
  <body>
    small
  </body>
</html>
```

尽管 `small.js` 早就下载完了，但是要等到 HTML 完成解析后才会执行。如果加上 `async`，则下载完成后立即会执行。

如果 `small.js` 中又 `import` 了 `small2.js`，默认情况也是要等到 HTML 完成解析后才会执行。如果加上 `async`，则两个文件下载完成后立即会执行。
