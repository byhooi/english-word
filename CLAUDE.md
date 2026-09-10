# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

面向五年级学生（沪教牛津五上）的静态英语学习站点，纯 HTML/CSS/JS，无构建步骤、无依赖、无测试框架。两个入口页面：

- `index.html` 单词探险岛：单词卡、三选一测验、全册单词听写、词表。
- `zs.html` 知识清单听写：按单元的常考短语与经典句型听写、清单一览、打印答题纸。

`AGENTS.md` 是仓库规范（编码风格、`localStorage` 字段约定、听写规则、提交格式），改动前先读，并在结构变化时同步更新它。

## 常用命令

```powershell
# 本地预览（无需安装任何东西）
python -m http.server 4311
# 访问 http://localhost:4311/ 和 http://localhost:4311/zs.html

# 提交前语法与空白检查（Windows PowerShell 5.1 不支持 &&，用分号）
node --check app.js; node --check zs_app.js; node --check speech.js; node --check dictation.js; node --check flashcard.js; node --check words.js; node --check zs_data.js
git diff --check

# 修改知识清单数据：改 generate_zs_data.py 里的 data 列表，再重新生成 zs_data.js（不要手改 zs_data.js）
python generate_zs_data.py

# 无头浏览器冒烟测试（本机有 Edge）：检查页面脚本能否初始化
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file:///D:/Documents/Github/english-word/zs.html"
```

没有自动化测试，验证靠浏览器手动点：两种屏宽、单元切换、翻卡、发音、听写开始/暂停/组尾停止/重听/重来本组、`localStorage` 恢复、打印预览。

## 架构

### 脚本分层与加载顺序

所有脚本是 IIFE，通过 `window.*` 暴露，`<script>` 顺序即依赖顺序：

```
数据(words.js / zs_data.js) → speech.js → flashcard.js → dictation.js → 页面脚本(app.js / zs_app.js)
```

- `speech.js` 暴露 `window.Speech`：浏览器 `speechSynthesis` 封装 + 设置读写。`speak*` 返回 Promise，读完 resolve(true)，被打断 resolve(false)，听写引擎依赖这一点判断是否继续。`speakEnglish` 会把 `...` 替换成 something 再读。
- `flashcard.js` 暴露 `window.createFlashcard(cardEl, {frontLabel, backLabel})`：翻卡的 class/aria/inert 切换，返回 `{toggle, reset}`。
- `dictation.js` 暴露 `window.createDictation(options)`：两个页面共用的纸上听写引擎。按固定 DOM id（`dictation*`）绑定元素和按钮事件；页面只提供 `getItems`、`getGroupSize`、`getRepeatDelay`、`getNextDelay(item)`、`speakChinese`、`speakEnglish`、`toast`、`onRender`、`onPositionChange`。返回 `{refresh, render, stop, start, repeat, move, restart, setGroup, handleKeydown, ...}`。**不要在页面脚本里再写一套播报流程。**
- `app.js` / `zs_app.js`：页面状态、过滤、渲染列表、事件绑定，把听写委托给 `createDictation`。

### 听写引擎的关键约定

- 令牌机制：每次 `stop()` 递增 `runToken`，所有 `await` 之后都校验令牌，保证暂停、切组、切模式后旧计时器不再推进。改异步流程时必须保留。
- 每题中文播两遍 → 等 `getNextDelay(item)` 毫秒 → 下一题；返回 `"manual"` 则停下等手动点击。
- `refresh(position)`：不传位置时保留原位置；若分组大小变了按绝对序号换算到新组。
- 单词页固定 5 词一组、全册展平不按单元重排；知识清单页按单元/类型过滤后分组，短语和句型各存一套分组大小与书写等待，「全部内容」时按句型分组、每题等待按该题类型取值。

### 数据形状

- `words.js`：`WORD_UNITS[]`，每词 `[en, zh, star?]` 经 `.map` 变成 `{id, en, zh, star}`，`id` 由单元 id 加英文 slug 生成，`app.js` 里有旧「单元-序号」id 的迁移映射。
- `zs_data.js`：`ZS_UNITS[]`（`{id,label,title,theme,phrases[],sentences[]}`）加展平的 `ZS_DATA[]`（每项带 `unitId`、`type: phrase|sentence`、`typeName`）。听写用 `ZS_DATA`，清单一览和打印用 `ZS_UNITS`。

### localStorage

两页共用 `word-island-settings` 一个 key，必须走 `Speech.saveSettings(patch)` 合并写入。`accent`、`rate` 跨页共享；知识清单页字段一律 `zs` 前缀（`zsUnit`、`zsType`、`zsGroup`、`zsIndex`、`zsPhraseGroupSize` 等），详见 `AGENTS.md`。收藏/已掌握分别在 `word-island-saved`、`word-island-mastered`。

### 样式

`styles.css` 是全站基础（含两页共用的 `.paper-dictation` 听写卡片样式和 620px/900px 断点）；`zs.css` 只放知识清单页专属样式和 `@media print` 打印答题纸。窄屏下 `.icon-button` 会被隐藏，顶栏按钮用这个类时要知道手机上看不到。

## 提交

Conventional Commits，中文描述，一次提交一个主题（见 git log 风格：`feat: 优化卡片显示样式……`）。
