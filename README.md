# Pickast 听荐

Pickast 是一款 AI 驱动的播客筛选工具，帮助听众从大量更新中快速发现真正值得听的内容。

在线体验：[pickast.vercel.app](https://pickast.vercel.app)

## 主要功能

- 每日精选：展示值得优先收听的播客单集、推荐理由和内容金句。
- 议题广场：聚合近期围绕同一话题的不同播客观点。
- 收藏夹：在浏览器本地保存喜欢的单集和观点。
- 小宇宙跳转：从推荐内容直接打开对应的单集或播客主页。
- 个性化订阅：OPML 导入功能正在开发中，未来可基于个人订阅生成推荐。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Motion

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

默认访问地址为 `http://127.0.0.1:3000`。

## 检查与构建

```bash
npm run lint
npm run build
```

## 项目状态

Pickast 目前是持续迭代中的 Web App。下一阶段重点是完成 OPML 导入、个性化内容生成和更完整的移动端体验。

欢迎通过 [GitHub Issues](https://github.com/MaggieDong0505/Pickast/issues) 提交反馈和建议。
