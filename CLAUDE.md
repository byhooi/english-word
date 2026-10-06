# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

面向五年级学生（沪教牛津五上）的静态英语学习站点，纯 HTML/CSS/JS，无构建步骤、无依赖、无第三方测试框架。两个入口页面：

- `index.html` 单词听写：单词卡、三选一测验、按单元听写、词表、按单元打印答题纸。
- `zs.html` 知识清单听写：按单元的常考短语与经典句型听写、清单一览、打印答题纸。

线上地址：`https://words.yangbing.eu.org/`（知识清单页 `https://words.yangbing.eu.org/zs.html`）。

`_d_meta.json` 是设计资产元数据，除同步设计交付状态外不要手动修改。TTS 生成脚本和生成的音频放在独立的工具仓库，不进本仓库。

本文件是仓库唯一的规范文档，结构或约定变化时同步更新它。

## 常用命令

```powershell
# 本地预览（无需安装任何东西）
python -m http.server 4311
# 访问 http://localhost:4311/ 和 http://localhost:4311/zs.html

# 提交前语法与空白检查（Windows PowerShell 5.1 不支持 &&，用分号）
node --check app.js; node --check zs_app.js; node --check speech.js; node --check dictation.js; node --check print.js; node --check flashcard.js; node --check words.js; node --check zs_data.js
git diff --check

# 修改知识清单数据：改 generate_zs_data.py 里的 data 列表，再重新生成 zs_data.js（不要手改 zs_data.js）
python generate_zs_data.py

# 无头浏览器冒烟测试（本机有 Edge）：检查页面脚本能否初始化
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file:///D:/Documents/Github/english-word/zs.html"
```

运行 `node scripts/check.cjs` 检查语法、数据 ID、存储降级和听写边界；完整交互仍需浏览器手动验收：

- 每次改动：桌面和窄屏两种宽度下的单元切换、翻卡、发音、收藏、测验、搜索、`localStorage` 恢复。
- 改听写：两个页面都要查分组数量、每题播两遍、间隔设置、开始/暂停、组尾停止、重听、重来本组、答案揭晓。
- 改知识清单页：切换类型后分组大小和书写等待是否跟着切换，刷新后是否回到上次的单元/类型/题目，打印预览。
- 改词库：重新确认总条数和分组边界。

## 架构

### 脚本分层与加载顺序

所有脚本是 IIFE，通过 `window.*` 暴露，`<script>` 顺序即依赖顺序：

```
数据(words.js / zs_data.js) → speech.js → flashcard.js → dictation.js → print.js → 页面脚本(app.js / zs_app.js)
```

- `speech.js` 暴露 `window.Speech`：浏览器 `speechSynthesis` 封装 + 设置读写。`speak*` 返回 Promise，读完 resolve(true)，被打断 resolve(false)，听写引擎依赖这一点判断是否继续。英文朗读统一走 `Speech.speakEnglish`，它会把 `...` 替换成 something 再读。
- `flashcard.js` 暴露 `window.createFlashcard(cardEl, {frontLabel, backLabel})`：翻卡的 class/aria/inert 切换，返回 `{toggle, reset}`。
- `dictation.js` 暴露 `window.createDictation(options)`：两个页面共用的纸上听写引擎。按固定 DOM id（`dictation*`）绑定元素和按钮事件；页面只提供 `getItems`、`getGroupSize`、`getRepeatDelay`、`getNextDelay(item)`、`speakChinese`、`speakEnglish`、`toast`、`onRender`、`onPositionChange`。返回 `{refresh, render, stop, start, repeat, move, restart, setGroup, handleKeydown, ...}`。**不要在页面脚本里再写一套播报流程。**
- `print.js` 暴露 `window.printAnswerSheet(pages)`：把 `[{title, subtitle?, sections:[{heading, items:[{zh}], columns}]}]` 渲染进 `#printSheet` 并调用 `window.print()`。
- `app.js` / `zs_app.js`：页面状态、过滤、渲染列表、事件绑定，把听写委托给 `createDictation`。

### 听写引擎的关键约定

- 令牌机制：每次 `stop()` 递增 `runToken`，所有 `await` 之后都校验令牌，保证暂停、切组、切模式后旧计时器不再推进。改异步流程时必须保留。
- 每题中文播两遍 → 等 `getNextDelay(item)` 毫秒 → 下一题；返回 `"manual"` 则停下等手动点击。
- `refresh(position)`：不传位置时保留原位置；若分组大小变了按绝对序号换算到新组。
- 单词页：用当前所选 Unit 的完整词表，按单元内原顺序每 5 个一组，最后一组可以不足 5 个；不跨单元混组，也不受翻卡打乱或收藏筛选影响。切换单元时停止播放并回到新单元第一组，听写模式下保留单元切换。
- 知识清单页：按单元/类型过滤后分组，短语和句型各存一套分组大小（5 或 10）与书写等待，「全部内容」时按句型分组、每题等待按该题类型取值。

### 打印答题纸

两页的「打印答题纸」都调 `window.printAnswerSheet(pages)`，样式在 `styles.css` 的 `@media print`。答题纸只有中文提示和一条书写线，不含英文答案，每个单元一页：

- 单词页：当前单元全部单词，两列。
- 知识清单页：当前单元全部短语（两列）和句型（单列），不受类型过滤影响；选「全部单元」时每单元一页。

### 数据形状

- `words.js`：`WORD_UNITS[]`，Unit 1–8 加「专有名词」。每词 `[en, zh, star?]` 经 `.map` 变成 `{id, en, zh, star}`，`id` 由单元 id 加英文 slug 生成。收藏/已掌握按 `id` 存，所以改单词拼写会换 id、丢掉该词进度，同一单元内 slug 也不能重复。`app.js` 里有旧「单元-序号」id 的迁移映射。
- `zs_data.js`：`ZS_UNITS[]`（`{id,label,title,theme,phrases[],sentences[]}`，条目为 `{en, zh}`）加展平的 `ZS_DATA[]`（每项带 `unitId`、`type: phrase|sentence`、`typeName`）。听写用 `ZS_DATA`，清单一览和打印用 `ZS_UNITS`。

### localStorage

两页共用 `word-island-settings` 一个 key，必须走 `Speech.saveSettings(patch)` 合并写入，不能整体覆盖。

- 两页共享：`accent`、`rate`。
- 单词页：`autoSpeak`、`repeatDelay`、`nextDelay`、`dictationUnit`、`dictationGroup`。听写单元和单元内组号成对恢复；旧版只记了全册组号、没记单元，这种组号不直接复用。
- 知识清单页一律 `zs` 前缀：`zsUnit`、`zsType`、`zsGroup`、`zsIndex`、`zsRepeatDelay`、`zsPhraseGroupSize`、`zsPhraseNextDelay`、`zsSentenceGroupSize`、`zsSentenceNextDelay`。

收藏/已掌握分别在 `word-island-saved`、`word-island-mastered`。

### 样式

`styles.css` 是全站基础（含两页共用的 `.paper-dictation` 听写卡片样式、`@media print` 打印答题纸和 620px/900px 断点）；`zs.css` 只放知识清单页专属样式。窄屏下 `.icon-button` 默认隐藏，但发音设置保留；页面导航链接保留原有内联显示规则。

Logo 是手绘路径的 SVG（不依赖字体）：`logo.svg`（深蓝，单词页）和 `zs-logo.svg`（蓝色 `#0277bd`，知识清单页），两者除底色和 `<title>` 外完全相同，改造型时两个文件要同步。它们同时用作页面 favicon 和顶栏 `.brand-mark` 图片，倾斜角度画在 SVG 里，CSS 不再旋转。同时配套生成了对应的 PNG 图标：`logo.png` / `zs-logo.png`（300x300，供微信分享抓取卡片缩略图）与 `logo-touch-icon.png` / `zs-logo-touch-icon.png`（192x192，供手机“添加到主屏幕”作为桌面 App 图标）。

## 编码约定

- HTML：语义化标签、双引号属性、完整闭合标签。
- JavaScript：`const`/`let`、分号、两空格缩进；DOM id 用 camelCase（如 `dictationAutoBtn`）。
- CSS：类名 kebab-case（如 `dictation-tool-row`），颜色和间距优先复用 `:root` 变量。

## 安全

不要提交 `.env`、API Key 或本地凭据。前端不得嵌入 Gemini 等服务端密钥，页面语音只用浏览器 `speechSynthesis`。只把确认要发布的静态资源加入版本控制。

## 提交

Conventional Commits，中文描述，一次提交一个主题（见 git log 风格：`feat: 优化卡片显示样式……`），常用前缀 `feat:`、`fix:`、`docs:`、`refactor:`。PR 说明用户可见的变化和验证步骤；视觉改动附桌面和手机截图，词库改动注明来源和影响范围。


## 学习流程与回归检查

- `Speech.readData` / `Speech.writeData` 统一保护本地读写；写入失败使用内存降级。共享设置仍必须通过 `Speech.saveSettings(patch)` 合并。
- `word-island-mistakes` 独立保存错词 ID；答错会撤销已掌握，但不修改主动收藏。答对测验不自动标记掌握，主动点击“我记住了”才清除错词。
- 收藏可按本单元或全册复习；错词按全册复习。进入时生成列表快照，取消收藏或标记掌握后，下次进入更新范围。听写始终使用所选单元完整词表。
- 每轮测验从当前单元不重复抽取最多 10 题，末题展示正确题数，可再练一轮。
- 听写单独记录完成状态，最后一题暂停后继续不重置；语音失败只清理当前令牌对应的运行状态。
- `scripts/check.cjs` 使用 Node 内置模块，无需安装依赖。运行 `node scripts/check.cjs` 和 `git diff --check`。
- 手机保留发音设置入口。进度导入导出、真实设备语音测试和打印截图验收尚未包含在自动检查中。
