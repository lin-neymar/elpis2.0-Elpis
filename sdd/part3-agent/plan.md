# Part3 plan · Agent Runtime Harness

> 技术方案。回答：怎么分层、扩展点在哪、demo 与框架边界。
> 需求见 spec.md，顺序见 tasks.md。

## 分层（`app/ai/`）

按职责拆分，框架侧目录骨架与模块边界一致：

| 层 | 职责 |
|----|------|
| **llm** | 统一对话 / 流式；OpenAI 兼容 Provider 为主通路 |
| **embedding** | 向量化；供 RAG 与记忆检索 |
| **store** | Trace、Thread/Checkpoint、向量索引、Eval 报告等**持久化抽象** |
| **skill** | 可扫描注册的能力单元（demo 编译产出 `dist/skills/*.js`） |
| **tool** | Agent 可调用的工具注册表 |
| **mcp** | MCP 客户端；外部进程 tool 与内置 Skill **同形态**进 steps |
| **agent** | 纯声明（人设、可用 skill/tool、策略）；**无执行逻辑** |
| **runtime** | Orchestrator：多轮、skill 调用、流式事件、组装 `runId` / `output` / `steps` |
| **rag** | 检索增强；chunk 策略可配置 |
| **memory** | Thread / Checkpoint；上下文经 Store |
| **guardrail** | 输入输出拦截；拦截记录进 Trace |
| **trace** | run 回放；与 Store 读写 |
| **eval** | 离线评测脚本与报告；**框架不提供** `/api/ai/eval` |

## 三种复用方式

1. **扫描注册**：Skill（demo `build:modules` / skills 产物）、Tool、Agent 清单由框架启动时扫描并暴露 list API
2. **接口 + 换实现**：Store、LlmProvider 等面向接口；demo 注入具体实现与路径（DB、文件、向量库）
3. **纯框架逻辑**：Orchestrator、流式协议、Guardrail 钩子、Trace 形状、steps 结构

## 框架无状态

- Trace、对话记忆、向量索引**一律走 Store 接口**；框架不硬编码存储路径或业务表结构
- 实现类、连接串、索引名由 demo 的 `config.default.js` 与 DI 注册注入
- 重启后同 `threadId` 上下文仍在，取决于 demo Store 实现（验收以 T10 为准）

## 模型接入

- **不逐家写 SDK**：一份 **OpenAI 兼容** Provider 覆盖大部分厂商（baseURL + apiKey + model）
- 默认选型：`elpis2.0-demo` 的 `config.default.js` → **`ai.llm`**（如 `ai.llm.default` 一行切换厂商仍通）
- 框架未内置的模型或协议：demo 实现 **`LlmProvider`** 并注册进框架 registry

## 前端边界

- Chat、Trace、Eval 等页在 demo 的 **custom 扩展位**；复用 Part1/Part2 的 dashboard 与 9002 脚本链路
- 组件如 `agent-chat`（逐字）、`tool-call-card`（渲染 step）在 demo；框架只保证 API 与 steps 形状

## 流式与 JSON 同构

- JSON：`POST /api/ai/agent/run` → `{ runId, output, steps }`
- 流式：SSE（或等价）逐 token / 中间事件；**done** 事件 payload 与 JSON 响应字段一致，便于 Chat 与 Trace 共用解析逻辑

## Nest 与鉴权

- `/api/ai/*` 挂在现有 AI Module / Controller；与 Auth、验签、442 等横切一致
- 不提供 eval HTTP API；`npm run eval` 写报告，eval 页读**同一份**报告文件或 Store 条目（由 demo 约定）
