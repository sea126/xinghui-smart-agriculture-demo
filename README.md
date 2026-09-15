# 星茴智农 · 八角智慧种植决策系统

这是可运行的比赛演示版网站，包含病虫害辅助识别、产量预测与定制种植方案、品质干燥方案三大模块。种植和干燥方案先由前端规则生成；配置百炼 API 后，用户点击生成时可调用文本模型进行说明增强，超时或异常时保留规则结果。

## 本地运行

安装 Node.js 后，在项目目录运行：

```bash
npm ci
npm test
npm run build
```

随后用本地静态服务器打开 `dist/index.html`。仅用 `file://` 打开时，云端 AI 接口不可用，但规则演示仍可查看。

## Netlify 部署

仓库已包含 `netlify.toml`。在 Netlify 中连接此仓库，构建命令使用 `npm run build`，发布目录为 `dist`，Functions 目录为 `netlify/functions`。如需启用 AI，在 Netlify 环境变量中设置 `DASHSCOPE_API_KEY`；模型和地域配置见 `.env.example` 与 `AI_DEPLOYMENT_GUIDE.md`。密钥只在 Netlify 服务端使用，不写入前端或 Git 仓库。

## 数据与证据

站内产区趋势和工艺参数为演示数据。原始收集资料、用户上传图片、生成的发布包和参赛材料保留在本地，不随源码仓库上传。图表设计源文件位于 `figures/`，可运行源码位于项目根目录和 `netlify/functions/`。
