# Repository Guidelines

## 项目结构与模块组织

本仓库是一个无需构建的静态英语学习站点，包含两个页面：

- 单词页：`index.html` 定义单词卡、闯关测验、全册听写和词表；`app.js` 实现这些模式与本地进度；`words.js` 保存 Unit 1–8 与专有名词数据；`styles.css` 负责视觉样式与响应式布局。
- 知识清单页：`zs.html` 定义纸上听写、清单一览和打印答题纸；`zs_app.js` 实现单元/类型过滤、分类型分组与等待设置、进度记忆和打印；`zs_data.js` 保存各单元常考短语与经典句型，由 `generate_zs_data.py` 生成，不要手改；`zs.css` 在 `styles.css` 之上扩展页面专属样式和 `@media print` 打印样式。
- 共用模块：`speech.js` 封装浏览器语音朗读与 `localStorage` 设置读写；`flashcard.js` 提供翻卡交互；`dictation.js` 是两个页面共用的纸上听写引擎。

`_d_meta.json` 是设计资产元数据，除同步设计交付状态外不要手动修改。TTS 生成脚本和生成音频应保存在独立工具仓库。

## 本地运行与检查命令

项目没有依赖安装或编译步骤。在仓库根目录运行：

```powershell
python -m http.server 4311
```

然后访问 `http://localhost:4311/` 与 `http://localhost:4311/zs.html`。提交前执行：

```powershell
node --check app.js; node --check zs_app.js; node --check speech.js; node --check dictation.js; node --check flashcard.js; node --check words.js; node --check zs_data.js
git diff --check
```

前一行检查 JavaScript 语法，后一行检查空白错误和冲突标记。

## 编码风格与命名约定

HTML 使用语义化标签、双引号属性和完整闭合标签。JavaScript 使用 `const`/`let`、分号和两个空格缩进；DOM 标识采用 camelCase，例如 `dictationAutoBtn`。CSS 类名使用 kebab-case，例如 `dictation-tool-row`，颜色和间距优先复用 `:root` 变量。单词页词条保持 `{ id, en, zh, star }` 结构及稳定、唯一的单元内 ID；知识清单条目保持 `{ en, zh }`，扁平化后的 `ZS_DATA` 带 `unitId`、`type`、`typeName`。

## 本地设置与进度

两个页面共用 `localStorage` 的 `word-island-settings`，必须通过 `Speech.saveSettings(patch)` 合并写入，不得整体覆盖。`accent`、`rate` 跨页面共享；单词页字段为 `autoSpeak`、`repeatDelay`、`nextDelay`、`dictationGroup`；知识清单页字段统一加 `zs` 前缀（`zsUnit`、`zsType`、`zsGroup`、`zsIndex`、`zsRepeatDelay`、`zsPhraseGroupSize`、`zsPhraseNextDelay`、`zsSentenceGroupSize`、`zsSentenceNextDelay`）。收藏词与已掌握词仍分别存于 `word-island-saved`、`word-island-mastered`。

## 听写与语音规则

听写引擎在 `dictation.js`，两个页面只提供数据、分组大小、等待时间和朗读函数，不要在页面内另写一套播报流程。

- 单词页：数据来自展平后的完整词表，不按单元重新排序；始终按原顺序每 5 个一组，最后一组允许不足 5 个。
- 知识清单页：按当前单元和类型过滤后分组。短语与句型各记一套分组大小（5 或 10）和书写等待；选"全部内容"时分组按句型设置，每题的书写等待按该题类型取值。书写等待支持 `manual`（播报两遍后停下等手动点击）。
- 每个中文提示播放两遍，随后按等待时间进入下一题。修改异步播放时必须保留运行令牌和停止逻辑，防止暂停、切换模式或切组后旧计时器继续推进。
- 英文朗读统一经 `Speech.speakEnglish`，它会把 `...` 替换为 something 后再读。API Key 不得放入前端；页面语音仅使用浏览器 `speechSynthesis`。

## 打印答题纸

`zs.html` 的"打印答题纸"按当前单元输出（"全部单元"时每单元一页），包含该单元全部短语与句型的中文提示和书写线，不含英文答案，不受类型过滤影响。内容由 `zs_app.js` 写入 `#printSheet`，样式在 `zs.css` 的 `@media print` 中。

## 测试要求

当前没有自动化测试框架。每次修改至少验证桌面端和窄屏布局，以及单元切换、翻卡、发音、收藏、测验、搜索和 `localStorage`。听写改动还需在两个页面都检查：分组数量、每题播放两遍、间隔设置、开始/暂停、组尾停止、重听、重来本组和答案揭晓。知识清单页还要检查切换类型后分组大小和书写等待是否随之切换、刷新后是否回到上次的单元/类型/题目，以及打印预览。词库修改后需重新确认总条数及分组边界。

## 提交与拉取请求

提交采用 Conventional Commits，例如 `feat: add dictation controls`。使用 `feat:`、`fix:`、`docs:`、`refactor:` 等前缀，并保持一次提交只处理一个主题。拉取请求应说明用户可见变化和验证步骤；视觉改动附桌面与移动截图，词库更改注明来源和受影响范围。

## 安全与配置

不要提交 `.env`、API Key 或本地凭据。前端不得嵌入 Gemini 等服务端密钥；仅将确认需要发布的静态资源加入版本控制。
