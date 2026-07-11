# Repository Guidelines

## 项目结构与模块组织

本仓库是一个无需构建的静态英语单词学习页面。`index.html` 定义页面结构和资源入口；`styles.css` 负责视觉样式及响应式布局；`app.js` 实现单词卡、测验、浏览器朗读和本地进度；`words.js` 保存 Unit 1–8 与专有名词数据。`_d_meta.json` 是设计资产元数据，除非同步设计交付状态，否则不要手动修改。音频生成脚本和大体积音频应放在独立 TTS 仓库中。

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

HTML 使用语义化标签、双引号属性和完整闭合标签。JavaScript 使用 `const`/`let`、分号和两个空格缩进；DOM 标识采用清晰的 camelCase，例如 `quizNextBtn`。CSS 类名使用 kebab-case，例如 `answer-button`，颜色和间距优先复用 `:root` 变量。新增词条必须保持 `{ id, en, zh, star }` 数据结构，并使用稳定、唯一的单元内 ID。

## 测试要求

当前没有自动化测试框架。每次修改至少手动验证桌面端和窄屏布局，并检查单元切换、翻卡、发音、收藏、测验、搜索和 `localStorage` 进度。涉及词库时，抽查英文、中文释义和重点词标记是否与原始教材一致。

## 提交与拉取请求

现有历史采用 Conventional Commits 风格，例如 `feat: add audio resources...`。继续使用 `feat:`、`fix:`、`docs:`、`refactor:` 等前缀，并保持一次提交只处理一个主题。拉取请求应说明用户可见变化、验证步骤和相关文件；视觉改动需附桌面端与移动端截图，词库更改需注明来源和受影响单元。

## 安全与配置

不要提交 `.env`、API Key 或本地凭据。前端代码不得嵌入 Gemini 等服务端密钥；需要生成音频时，应在独立工具仓库中读取环境变量，并仅将确认需要发布的成品资源加入版本控制。
