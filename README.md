# 达飞不记单词 / chasing pavement

浏览器英语听写练习，内置 100 条旅行表达。支持例句朗读、每日打卡、错题、学习进度和完整备份。

## 部署到 Vercel

将本目录内容放进 GitHub 仓库，Vercel 导入该仓库。
- Framework Preset: Other
- Root Directory: 仓库根目录（若上传整个工作目录则选 deploy）
- Output Directory: public
- 不需要 Build Command、Install Command 或环境变量。
- Node.js: 22.x；个人非商业用途选择 Hobby。

public 是网页，api/lookup.mjs 是联网词义与音标补全接口，lib 是词典查询逻辑。

## 学习数据

词库与进度仅存储于访问者自己的浏览器，不上传 GitHub 或服务器。上线后与 localhost 数据分开，请先从本地导出完整学习备份，再在线上恢复。

联网补全使用 MyMemory / Free Dictionary API，受外部服务可用性和额度影响。不调用 AI API，不需要密钥。
