# Part3 spec · Agent Runtime Harness

> 需求分析。先走完 spec → plan → tasks，再贴实现 Prompt（开头钉三件套）。本文件在 **elpis** 仓库。

## 目标

在已有 Vite + Nest 之上，为 elpis 增加一层**可上线的 Agent Runtime Harness**：框架提供 LLM / Skill / Tool / Agent / Orchestrator / 流式协议 / Trace / RAG / 记忆 / Guardrail / Eval 等运行时能力；业务 Skill、Store 实现、MCP 声明、模型选型由 **elpis2.0-demo** 注入与扩展。

## 稳定面（合同）

- `serverStart()` / `frontendBuild()` 签名与行为不变
- `POST /api/ai/agent/run` 返回 `{ runId, output, steps }`，**字段名锁死**，不得改名或增删顶层键语义
- 流式端点（如 `/api/ai/agent/run/stream`）的 **done 事件** payload 与 JSON 端点**同构**（同样含 `runId`、`output`、`steps`）
- `/api/ai/*` 走**登录 + 验签**，**不进白名单**（禁止为演示关闭鉴权）
- 前端 UI 全部在 **elpis2.0-demo**；页面走已有的 **custom 扩展位**；框架**不新增** `moduleType`

## 禁止

- 在 demo 里自写 `runAgent()` 绕过框架 Orchestrator
- 把「查项目」等业务逻辑写进框架（应作为 demo 注册的 Skill / Tool）
- 为 Chat 另起 `index.html` 或独立前端工程
- 修改 `runId` / `output` / `steps` 字段名
- 为演示关掉鉴权或把 `/api/ai/*` 加入免登录白名单

## 验收（Part 结束）

- 登录态下 Chat / Agent run / 流式 / Trace / Eval 页可用；未登录或验签失败与 1.0 横切一致
- `POST /api/ai/agent/run` 与流式 done 均满足合同字段
- walkthrough 覆盖流式、MCP、RAG、记忆、Guardrail、Trace、Eval、多 Agent；**框架无状态**验收通过（Trace / 记忆 / 向量索引经 Store 接口，实现由 demo 注入）
