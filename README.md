# @zwl_11/elpis

面向企业 AI 应用研发的 **Agent 全栈开发框架**：以 NestJS 模块化服务端 + Vue3/Vite 前端为底座，集成可插拔模型接入、RAG 知识检索、Agent 编排、MCP 外部工具、多轮记忆与质量保障（Guardrail / Trace / Eval），框架以 NPM 包形态与业务仓解耦，支持多业务项目独立安装、升级与复用。

## 能力总览

| 能力       | 说明                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 模型接入   | 可插拔 LLM / Embedding Gateway，配置驱动切换多 Provider（OpenAI 兼容协议、DashScope、Mock 等） |
| Agent 编排 | `*.agent.ts` 文件约定注册；内置自研 ReAct Loop 与 LangGraph 状态图双运行时                     |
| RAG        | 文档切分 → 批量向量化 → 灌库 → 余弦 TopK 检索，检索以内置 Tool 形式对 Agent 开放并约束引用出处 |
| 外部工具   | 自研 MCP 客户端（stdio / HTTP Streamable 双传输），MCP Server 工具自动注册为 Agent 工具        |
| 多轮记忆   | Thread 检查点持久化 + 轮次截断，支持跨请求追问与重启恢复                                       |
| 质量保障   | Guardrail 前置拦截、Trace 全链路回放、Eval 行为轨迹断言（无框架依赖，可离线跑批）              |
| 前端       | Vue3 + Element Plus 动态组件库；DSL 一份 Schema 生成搜索/表格/表单 CRUD 页面                   |
| 工程化     | NestJS 模块自动扫描 + Vite 多入口构建；业务仓无需安装框架内依赖                                |

## 顶层目录

| 路径                                                | 职责                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------- |
| `app/main.ts` / `app.module.ts` / `elpis.module.ts` | Nest 启动与模块装配                                                                                                                   |
| `app/ai/`                                           | AI 子系统（llm / embedding / rag / agent / skill / tool / mcp / runtime / lc-lg-runtime / memory / guardrail / trace / eval / store） |
| `app/common/`                                       | 统一请求管道（鉴权、验签、参数校验、异常处理）与 `loadBusinessModules` 业务模块扫描                                                   |
| `app/modules/project                                | view                                                                                                                                  | fallback` | 框架内置 API / 视图 / GET `*` 兜底 |
| `app/pages` + `app/vite` + `app/public`             | 前端工程（Vite 9002 → Nest 8080 静态）                                                                                                |
| `config/`                                           | 框架默认配置                                                                                                                          |
| `model/`                                            | 框架侧 model 索引（业务仓用自家 `model/`）                                                                                            |
| `dist/`                                             | Nest 编译产物（含 `.d.ts` 类型声明）                                                                                                  |
| `index.js`                                          | 对外 API：`serverStart` / `frontendBuild` / Eval 断言                                                                                 |

## 快速开始

### 安装

```bash
npm install @zwl_11/elpis
```

### 服务端启动

```javascript
const { serverStart } = require('@zwl_11/elpis');

// 启动 elpis 服务（options 透传到 Nest bootstrap）
const app = serverStart({});
```

### 前端构建

业务仓 `build.js` 调用框架 API：

```javascript
const { frontendBuild } = require('@zwl_11/elpis');

// local → Vite Dev Server :9002；production → vite.build 写 dist/prod
frontendBuild(process.env._ENV);
```

构建器在框架包 `app/vite/`，业务仓禁止自行 `import vite` / 手写 `vite.config.ts`。

## AI 能力

### 1. 模型接入（LLM / Embedding Gateway）

框架内置 OpenAI 兼容协议 Provider，业务仓可在 `app/llm-providers/` 注册自定义 Provider 类（如 `dashscope-native.provider.ts`、`local.provider.ts`、`mock.provider.ts`），通过配置切换，业务代码无感知。

### 2. RAG 知识检索

- **灌库**：扫描目录下 `*.txt / *.md` → 按 `chunk.size / overlap` 切分（支持注册自定义 Chunker）→ 批量 Embedding 向量化 → 写入 VectorStore；
- **检索**：问题向量化 → 余弦 TopK 召回，返回带 `docId` 出处元信息的片段；
- **对 Agent 开放**：检索内置为 `retrieve` Tool，通过 Tool 描述约束回答必须引用 `docId` 出处，实现可溯源问答。

### 3. Agent / Skill / Tool 注册机制

框架启动时扫描业务仓 `process.cwd()` 下的编译产物：

| 产物                          | 源目录                  | 说明                                                                                          |
| ----------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `dist/agents/**/*.agent.js`   | `app/agents/*.agent.ts` | Agent 纯声明（name / skills / tools / prompt 或 promptFile），不写执行逻辑                    |
| `dist/skills/**/*.skill.js`   | `app/skills/*.skill.ts` | Skill 定义（name / description / inputSchema / execute），自动转成 LLM function tools payload |
| `dist/modules/**/*.module.js` | `app/modules/`          | Nest 业务模块自动扫描挂载                                                                     |

Agent 声明示例：

```typescript
import type { AgentDefinition } from '@zwl_11/elpis/dist/ai/agent/agent.interface';

const projectAssistantAgent: AgentDefinition = {
  name: 'project-assistant',
  skills: ['project-query'],
  tools: ['service-invoke', 'list_directory', 'write_file', 'retrieve'],
  promptFile: '../prompts/project-assistant.prompt.js',
};

export default projectAssistantAgent;
```

### 4. 运行时（编排引擎）

- **自研 ReAct Loop**（`runtime/`）：plan → execute → observe 循环，`MAX_ITERATIONS` 刹车，AsyncGenerator 流式产出步骤事件；
- **LangGraph 状态图**（`lc-lg-runtime/`）：`plan / execute / observe` 三节点 + 条件边，`state.iteration` 刹车（`recursionLimit` 只作天花板），内部使用 LangChain Planner；
- 当前 HTTP 控制器默认挂载 LangGraph 编排器，两套实现共享同一 Executor 与 Trace 管线。

### 5. MCP 外部工具

自研 MCP 客户端，支持 **stdio（换行分帧 JSON-RPC）** 与 **HTTP Streamable** 双传输；启动时按配置连接 MCP Server，`tools/list` 发现后自动注册进 ToolRegistry，Agent 声明 `tools: ['list_directory', ...]` 即可调用。

### 6. 多轮记忆

以 `threadId` 组织对话线程：每轮结束后追加到检查点并持久化（`MemoryStore`），加载时按 `maxTurns` 截断，支持跨请求追问与服务重启后恢复。

### 7. Guardrail / Trace / Eval

- **Guardrail**：配置化禁用关键词 + 正则，进入编排前前置拦截，命中即返回拦截结果；
- **Trace**：按 `runId` 记录输入、消息序列与每一步（plan / tool / skill / observe / guardrail / final），支持全链路回放；
- **Eval**：断言层为纯函数（无 Nest 依赖），断言**行为轨迹**（步骤命中 / 输出非空 / 拦截命中 / 多轮追问），可被纯 Node 脚本直接 require 离线跑批。

## AI 配置参考

框架侧 `config/config.default.js` 只放通用默认值，AI 相关配置在**业务仓** `config/` 下（参考 elpis2.0-demo 的 `config/config.default.js`，`ai.*` 结构如下）：

```javascript
module.exports = {
  ai: {
    // LLM：default 指定默认模型，models 支持 provider 协议配置或 use 自定义 Provider 类
    llm: {
      default: 'qwen',
      models: {
        qwen: {
          provider: 'openai-compatible',
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: 'qwen-plus',
          apiKey: 'xxxx',
        },
        mock: { use: MockProvider },
        local: { use: LocalProvider },
      },
    },
    // 编排循环上限（缺省 5）
    runtime: { maxIterations: 5 },
    // Embedding：结构与 llm 一致
    embedding: {
      default: 'qwen',
      models: {
        qwen: {
          provider: 'openai-compatible',
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: 'text-embedding-v3',
          apiKey: 'xxxx',
        },
      },
    },
    // RAG：切分粒度、召回数、retrieve Tool 描述
    rag: {
      chunk: { size: 500, overlap: 80 },
      topK: 4,
      tool: { description: '从知识库检索片段；回答必须引用 docId' },
    },
    // Store：Trace / Vector / Memory 三类存储注入（driver 可替换为 Qdrant 等外部实现）
    store: {
      trace: './data/trace',
      vector: { driver: 'file', path: './data/vector', fixturesPath: './data/fixtures' },
      memory: { driver: 'file', path: './data/memory', maxTurns: 20 },
    },
    // MCP：stdio 用 command/args，HTTP 用 url
    mcp: {
      enabled: true,
      servers: [{ name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] }],
    },
    // Guardrail：关键词 + 正则
    guardrail: {
      blockedKeywords: ['删除所有数据库', 'drop database', 'rm -rf'],
      blockedPatterns: [/忽略以上.*要求/i],
    },
    // Eval：用例 glob、报告路径、评测目标服务地址
    eval: {
      casesGlob: 'dist/eval/*.cases.js',
      reportPath: './data/eval/report.json',
      apiBase: 'http://localhost:8080/api/ai',
    },
  },
};
```

## HTTP API

| 方法 | 路径                         | 说明                                                                           |
| ---- | ---------------------------- | ------------------------------------------------------------------------------ |
| POST | `/api/ai/chat`               | 单次对话（message 或 messages）                                                |
| POST | `/api/ai/chat/stream`        | SSE 流式对话（`token` / `done` 事件）                                          |
| POST | `/api/ai/agent/run`          | 运行 Agent（agent / input / threadId），返回 runId / output / steps            |
| POST | `/api/ai/agent/run/stream`   | SSE 流式运行 Agent（`step` / `delta` / `done` 事件，前端可实时可视化推理步骤） |
| POST | `/api/ai/rag/ingest`         | 知识库灌库（body.path，缺省用 `store.vector.fixturesPath`）                    |
| GET  | `/api/ai/tool/list`          | 已注册工具列表                                                                 |
| GET  | `/api/ai/agent/list`         | 已注册 Agent 列表                                                              |
| GET  | `/api/ai/agent/graph`        | LangGraph 图结构（节点与边）                                                   |
| POST | `/api/ai/skill/:name/invoke` | 直接调用 Skill                                                                 |
| GET  | `/api/ai/trace/:runId`       | 按 runId 回放 Agent 运行轨迹                                                   |

所有 `/api/ai/*` 均走框架统一鉴权与验签（不在白名单内）。

## 知识库灌库与离线评测

### 灌库

```bash
curl -X POST http://localhost:8080/api/ai/rag/ingest \
  -H 'Content-Type: application/json' \
  -d '{"path": "./data/fixtures"}'
```

### 离线评测（需服务已启动）

评测用例定义在业务仓 `app/eval/*.cases.ts`（编译到 `dist/eval/*.cases.js`），断言类型：

- `stepsContain`：步骤轨迹命中指定 skill / tool 名
- `outputNotEmpty`：输出非空
- `guardrailBlocked`：命中拦截
- `outputContainsAny`：输出包含指定子串（如引用出处）
- `turns`：多轮追问断言

```bash
npm run eval
```

跑批脚本为纯 Node 进程（不经 Nest import），通过 HTTP 驱动用例执行，断言层离线判 pass/fail，汇总报告写入 `data/eval/report.json`。

## DSL 模型驱动页面（model 配置）

前端通过一份 model 配置生成页面，`moduleType: 'schema'` 的菜单项按 Schema 动态生成搜索栏、表格与表单 CRUD：

```javascript
{
    model: 'dashboard', // 模版类型，不同模版类型对应不一样的模版数据结构
    name: '', // 名称
    desc: '', // 描述
    icon: '', // icon
    homePage: '', // 首页（项目配置）

    // 头部菜单
    menu: [{
        key: '', // 菜单唯一描述
        name: '', // 菜单名称
        menuType: '', // 枚举值：group / module

        // 当 menuType == group 时，可填
        subMenu: [{
         // 可递归 menuItem
        },...],

        // 当 menuType == module 时，可填
        moduleType: '', // 枚举值：sider / iframe / custom / schema

        // 当 moduleType == sider 时
        siderConfig: {
            menu: [{
                // 可递归 menuItem(除 moduleType === sider)
            },...]
        },

        // 当 moduleType == iframe 时
        iframeConfig: {
            parh: '', // iframe 路径
        },

        // 当 moduleType == custom 时
        customConfig: {
            path: '', // 自定义路由路径
        },

        // 当 moduleType == schema 时
        schemaConfig: {
            api: '', // 数据源API（遵循 RESTFUL 规范）
            schema: { // 板块数据结构
                type: 'object',
                properties: {
                    key: {
                        ...schema, // 标准的 schema 配置
                        type: '', // 字段类型
                        label: '', // 字段的中文名
                        // 字段在 table 中的相关配置
                        tableOption: {
                            ...elTableColumnConfig, // 标准 el-table-column 配置
                            toFixed: 0, // 保留小数点后几位
                            visible: true, // 默认为 true (false 时，表示不在表单中显示)
                        },
                        // 字段在 search-bar 中的相关配置
                        searchOption: {
                            ...elComponentConfig, // 标准 el-component-column 配置
                            comType: '', // 配置组件类型 input/select/...
                            default: '', // 默认值

                            // comType === 'select'
                            enumList: [], // 下拉框可选项

                            // comType === dynamicSelect
                            api: '',
                        },
                        // 字段在不同动态 component 中的相关配置，前缀对应 componentConfig 的键值
                        // 如：componentConfig.createForm，这里对应 createFormOption
                        // 字段在 createForm 中相关配置
                        createFormOption: {
                            ...eleComponentConfig, // 标准 el-component 配置
                            comType: '', // 控件类型 input/select/input-number
                            visible: true, // 是否展示（true/false），默认为 true
                            disabled: false, // 是否禁用（true/false），默认为 false
                            default: '', // 默认值

                            // comType === 'select' 时生效
                            enumList: [], // 枚举列表
                        },
                        // 字段在 editForm 表单中的相关配置
                        editFormOption: {
                            ...eleComponentConfig, // 标准 el-component 配置
                            comType: '', // 控件类型 input/select/input-number
                            visible: true, // 是否展示（true/false），默认为 true
                            disabled: false, // 是否禁用（true/false），默认为 false
                            default: '', // 默认值

                            // comType === 'select' 时生效
                            enumList: [], // 枚举列表
                        },
                        // 字段在 detailPanel 表单中的相关配置
                        detailPanelOption: {
                            ...eleComponentConfig, // 标准 el-component 配置
                        },
                    },
                },
                required: [], // 标记哪些字段是必填项
            },
            // table 相关配置
            tableConfig: {
                headerButtons: [
                    {
                        label: '', // 按钮中文名
                        eventKey: '', // 按钮事件名
                        eventOption: {
                            // 当 eventKey === 'showComponent'
                            comName: '', // 组件名称
                        }, // 按钮事件具体配置
                        ...elButtonConfig, // 标准的 el-button 配置
                    },
                ], // 列表头部操作按钮
                rowButtons: [
                    {
                        label: '', // 按钮中文名
                        eventKey: '', // 按钮事件名
                        eventOption: {
                            // 当 eventKey === 'showComponent'
                            comName: '', // 组件名称

                            // 当eventKey === 'remove'
                            params: {
                                // paramKey = 参数的键值
                                // rowValueKey = 参数值 （格式为 schema:tableKey，到table中找相应的字段）
                                paramKey: rowValueKey,
                            },
                        }, // 按钮事件具体配置
                        ...elButtonConfig, // 标准的 el-button 配置
                    },
                ], // 列表行操作按钮
            },
            // search-bar 相关配置
            searchConfig: {},
            // 动态组件 相关配置
            componentConfig: {
                // create-form 表单相关配置
                createForm: {
                    title: '', // 表单标题
                    saveBtnText: '', // 保存按钮文案
                },
                // edit-form 表单相关配置
                editForm: {
                    mainKey: '', // 表单主键，用于唯一标识要修改的数据对象
                    title: '', // 表单标题
                    saveBtnText: '', // 保存按钮文案
                },
                // detail-panel 表单相关配置
                detailPanel: {
                    mainKey: '', // 表单主键，用于唯一标识要修改的数据对象
                    title: '', // 表单标题
                },

                // ...支持用户动态扩展
            },
        },
    }]
}
```

## 前端工程

### Vite 双终端启动（开发）

在业务仓（elpis2.0-demo）开两个终端：

```bash
# 终端 1：Vite 出脚本 + HMR（9002）
npm run build:dev

# 终端 2：Nest 渲染 .tpl、提供 API（8080）
npm run dev
```

打开 `http://localhost:8080/view/auth/login`。页面由 8080 渲染，脚本从 `http://127.0.0.1:9002` 加载。

生产（无 9002）：

```bash
npm run build:prod   # 产物落到 app/public/dist/prod/
npm run prod         # 仅 Nest :8080，静态目录读 /dist/prod/
```

### 页面扩展

- 自定义页面：在 `app/pages/` 下写入口 `entry.xxx.js`；
- dashboard / custom-view：在 `app/pages/dashboard/xxxx` 下写页面；
- schema-view 动态组件：在 `app/pages/dashboard/complex-view/schema-view/components` 下写组件，并配置到同目录 `component-config.js`；
- schema-form 控件：在 `app/pages/widgets/schema-form/complex-view` 下写控件，并配置到 `form-item-config.js`；
- schema-search-bar 控件：在 `app/pages/widgets/schema-search-bar/complex-view` 下写控件，并配置到 `search-item-config.js`。

## 本地联调（npm link）

在 **elpis** 框架仓：

```bash
npm link
```

在 **业务仓**：

```bash
npm link @zwl_11/elpis
```

业务仓不要在本地写构建器。改框架后重新 link / 重启 `build:dev`，`.tpl` 才会按新逻辑生成。

## 发布

```bash
npm run build       # prepublishOnly 会自动执行
npm publish --access public
```

- `files` 白名单：`dist` / `index.js` / `app` / `config` / `model`；
- 编译产物含 `.d.ts` 类型声明（`declaration: true`），业务仓可经 `exports` 子路径引入类型；
- 框架内置 `@nestjs/*` 依赖，业务模块经依赖解析钩子统一走框架实例，业务仓无需重复安装。

## License

ISC
