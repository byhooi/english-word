# Repository Guidelines

## 项目结构与模块组织

本仓库是一个无需构建的静态英语单词学习页面。`index.html` 定义页面结构与学习模式入口；`styles.css` 负责视觉样式和响应式布局；`app.js` 实现单词卡、测验、全册听写、浏览器朗读及本地进度；`words.js` 保存 Unit 1–8 与专有名词数据。`_d_meta.json` 是设计资产元数据，除同步设计交付状态外不要手动修改。TTS 生成脚本和生成音频应保存在独立工具仓库。

## 本地运行与检查命令

项目没有依赖安装或编译步骤。在仓库根目录运行：

```powershell
python -m http.server 4311
```

然后访问 `http://localhost:4311/`。提交前执行：

```powershell
node --check app.js
node --check words.js
git diff --check
```

前两条检查 JavaScript 语法，最后一条检查空白错误和冲突标记。

## 编码风格与命名约定

HTML 使用语义化标签、双引号属性和完整闭合标签。JavaScript 使用 `const`/`let`、分号和两个空格缩进；DOM 标识采用 camelCase，例如 `dictationAutoBtn`。CSS 类名使用 kebab-case，例如 `dictation-tool-row`，颜色和间距优先复用 `:root` 变量。新增词条保持 `{ id, en, zh, star }` 结构及稳定、唯一的单元内 ID。

## 听写与语音规则

听写数据来自展平后的完整词表，不按单元重新排序；始终按原顺序每 5 个一组，最后一组允许不足 5 个。每个中文提示播放两遍，随后按用户设置的等待时间进入下一词。修改异步播放时必须保留运行令牌和停止逻辑，防止暂停、切换模式或切组后旧计时器继续推进。API Key 不得放入前端；页面语音仅使用浏览器 `speechSynthesis`。

## 测试要求

当前没有自动化测试框架。每次修改至少验证桌面端和窄屏布局，以及单元切换、翻卡、发音、收藏、测验、搜索和 `localStorage`。听写改动还需检查：全册分组数量、每词播放两遍、间隔设置、开始/暂停、组尾停止、重听、重来本组和答案揭晓。词库修改后需重新确认总词数及五词分组边界。

## 提交与拉取请求

提交采用 Conventional Commits，例如 `feat: add dictation controls`。使用 `feat:`、`fix:`、`docs:`、`refactor:` 等前缀，并保持一次提交只处理一个主题。拉取请求应说明用户可见变化和验证步骤；视觉改动附桌面与移动截图，词库更改注明来源和受影响范围。

## 安全与配置

不要提交 `.env`、API Key 或本地凭据。前端不得嵌入 Gemini 等服务端密钥；仅将确认需要发布的静态资源加入版本控制。