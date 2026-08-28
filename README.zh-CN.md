# Customer Forms Hub | 中文说明

> 一个帮助团队处理客户安全和合规问卷的 React 应用。

Customer Forms Hub 让审核者可以上传问卷、找到相关内部知识、向合适的人求助，并最终确认回复。AI 帮助处理重复工作，但最终决定始终由人来做。

这是项目的前端仓库。后端负责处理文档、调用 AI、保存数据、导出文件和提供 AI Performance 数据。

在线演示使用 Railway 托管的 MySQL 数据库。

[英文 README](README.md) · [后端仓库](https://github.com/alisonzzzz-y/customer-form-hub)

[打开在线演示](https://customer-form-hub.vercel.app/)

<!--
截图占位：在这里加入以下三张图：
![Dashboard 和工作队列](docs/screenshots/dashboard.png)
![问题审核和 SME 升级](docs/screenshots/ticket-review.png)
![AI Performance 页面](docs/screenshots/ai-performance.png)
-->

## 用户可以做什么

```text
创建客户请求
  -> 上传 Excel 或 Word 问卷
  -> 查看问题和推荐的知识来源
  -> 接受答案、编辑答案，或请 SME 帮忙
  -> 跟踪未解决问题和预计回复时间
  -> 审核并导出完成后的回复
```

这个界面是审核工作台，不是聊天机器人。它为审核者提供上下文，但审核者始终负责最终答案。

## 我的贡献

前端是团队项目。我搭建了主要前端结构，并负责整合和审核同学提交的 pull requests。

## AI Performance 页面

Manager 可以看到两类简单信息：

- 审核结果：建议有多少被直接接受、编辑后接受，或发给 SME / AE。
- 检索检查：后端是否在前 1 个或前 3 个结果中找到了预期知识来源。

检索检查使用一小组模拟测试数据。它用于确认搜索功能在改动后仍然正常，不代表真实场景中的回答准确率。后端离线时，页面不会显示虚构的 AI 指标。

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React 18、TypeScript、Vite |
| UI | Tailwind CSS 4、Recharts、Lucide icons |
| 测试 | Vitest、Testing Library、Playwright |
| 后端连接 | 通过 `VITE_API_BASE` 配置的 REST API |

## 本地运行

连接真实后端：

```bash
npm install
VITE_API_BASE=http://localhost:8080 npm run dev
```

打开 Vite 输出的本地地址。左下角状态会显示前端是否已连接后端。

也可以运行本地 mock：

```bash
npm run mock
npm run dev
```

mock 适合开发界面和运行浏览器测试，但它不会代替真实后端的 AI 功能或 AI Performance 数据。

## 当前范围

- 角色切换只用于演示，不是登录或权限系统。
- 邮件操作只会通过 `mailto:` 打开草稿，不会真正发送邮件。
- AI Performance 示例和检索测试数据都是模拟数据，并有明确说明。
- 系统不会自动批准或发送 AI 辅助答案。
