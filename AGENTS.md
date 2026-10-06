# Repository Guidelines

## 项目结构与模块组织

本项目是面向五年级学生的静态英语学习站点，使用原生 HTML、CSS、JavaScript，无依赖安装和构建步骤。源码与图片资产均位于根目录，没有独立测试目录。

- `index.html`、`app.js`：单词卡、测验、单词听写与词表。
- `zs.html`、`zs_app.js`：短语和句型的知识清单听写。
- `speech.js`、`flashcard.js`、`dictation.js`、`print.js`：共享语音、翻卡、听写与打印模块。
- `styles.css`：公共及打印样式；`zs.css`：知识清单专属样式；`logo*`、`zs-logo*`：页面图标。
- `words.js`：单词数据；`generate_zs_data.py`：知识清单数据源及生成器；`zs_data.js`：生成结果。

## 开发与检查命令

在仓库根目录执行，预览需要 Python，语法检查需要 Node.js：

```powershell
python -m http.server 4311
# 浏览 http://localhost:4311/ 和 http://localhost:4311/zs.html
node --check app.js
node --check zs_app.js
git diff --check
```

对其他修改过的 JavaScript 文件同样运行 `node --check 文件名`。修改知识清单时，编辑生成器中的 `data`，执行 `python generate_zs_data.py`，同时提交源文件与生成结果；不要直接修改 `zs_data.js`。

## 编码风格与架构约定

- JavaScript 使用两空格缩进、`const`/`let` 和分号；DOM id 使用 camelCase，例如 `dictationAutoBtn`。
- HTML 使用语义化标签和双引号属性；CSS 类名使用 kebab-case，优先复用 `:root` 变量；Python 保持四空格缩进。
- 没有配置格式化器或 lint 工具，保持周边代码风格。对话与说明文档使用中文。
- 保持脚本加载顺序：数据、语音、翻卡、听写、打印、页面逻辑。复用 `createDictation`，不要另写播报流程；异步修改须保留取消令牌检查。

## 测试要求

使用 `node scripts/check.cjs` 运行无第三方依赖的语法、数据、存储与听写边界检查；没有覆盖率门槛。提交前完成语法检查，并在桌面和窄屏浏览器验证两个入口：单元切换、翻卡、发音、收藏、测验、搜索及刷新后的状态恢复。

听写改动需检查分组边界、每题重复两遍、等待间隔、暂停、重听和答案揭晓；打印改动需确认每单元分页且不泄露英文答案。词库改动需核对条目总数和分组。

## 提交与拉取请求

近期提交主要采用 Conventional Commits 与中文描述，例如 `fix: 修复听写暂停逻辑`。使用 `feat:`、`fix:`、`docs:` 或 `refactor:`，每次提交聚焦一个主题。

PR 应说明用户可见变化、影响范围和验证步骤；有相关 issue 时附链接。视觉改动附桌面及手机截图，词库改动注明来源。

## 数据与安全

通过 `Speech.saveSettings(patch)` 合并共享设置，禁止整体覆盖；知识清单专属字段使用 `zs` 前缀。修改单词拼写会改变 ID，需评估收藏和学习进度迁移。

不要提交密钥、`.env`、本地凭据或临时截图；语音使用浏览器 `speechSynthesis`。不要随意修改 `_d_meta.json`。详细架构约定参阅 `CLAUDE.md`，结构变化时同步维护相关说明。
