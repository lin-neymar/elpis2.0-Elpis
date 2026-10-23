# elpis

## Part2 成果（Koa → 全 Nest）

- HTTP 内核：`NestFactory` + `app/` 下 Module / Controller / Guard / Pipe / Filter；**已删除 `elpis-core/` 与 Koa 业务目录**。
- 对外不变：`index.js` 仍提供 `serverStart(options)`、`frontendBuild(env)`；`serverStart` → `require('./dist/main').bootstrap`。
- 业务扫描：`ElpisModule.register()` 加载 **业务仓** `process.cwd()/dist/modules/**/*.module.js`（框架只保留 `project` / `view` / `fallback`）。
- Demo 业务在 **elpis2.0-demo** 的 `app/modules/{auth,user,product}`，由扫描挂入，不写死在框架 `AppModule`。

### 顶层目录（框架仓）

| 路径 | 职责 |
|------|------|
| `app/main.ts` / `app.module.ts` / `elpis.module.ts` | Nest 启动与模块装配 |
| `app/common/` | 验签、校验 442、异常、静态兜底、`loadBusinessModules` |
| `app/modules/project|view|fallback` | 框架 API / 视图 / GET `*` 兜底 |
| `app/pages` + `app/vite` + `app/public` | 前端工程（Vite 9002 → 8080 静态） |
| `config/` | 框架默认配置 |
| `model/` | 框架侧 model 索引（demo 用自家 `model/`） |
| `dist/` | Nest 编译产物（勿 tsx 直跑 TS） |

### 本地双终端（elpis2.0-demo）

| 终端 | 目录 | 命令 | 作用 |
|------|------|------|------|
| A | elpis2.0-demo | `npm run build:dev` | Vite dev，页面脚本走 9002 |
| B | elpis2.0-demo | `npm run dev` | `build:modules` + tsc watch + nodemon 拉起 8080 Nest |

Part3 规划：框架侧 **`app/ai/`**（本 Part 未实现 Agent / LLM）。

---

## 一个企业级应用

### model配置

```javascript
{
    model: 'dashboard', // 模版类型，不同模版类型对应不一样的模版数据结构
    name: '', // 名称
    desc: '', // 描述
    icon: '', // icon
    homePage: '', // 首页（项目配置）

    // 头部菜单
    menu: [{
        key: '', //菜单唯一描述
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

### 服务端启动

```javascript
const { serverStart } = require('@zwl_11/elpis');

// 启动 elpis 服务
const app = serverStart({});
```

### 自定义服务端

- router-schema
- router
- controller
- service
- extend
- config

### 前端构建

业务仓 `build.js` **不要改**，继续调用框架 API：

```javascript
const { frontendBuild } = require('@zwl_11/elpis');

// local → Vite Dev Server :9002；production → vite.build 写 dist/prod
frontendBuild(process.env._ENV);
```

构建器在框架包 `app/vite/`，业务仓禁止 `import vite` / 手写 `vite.config.ts`。

### npm link（本地联调框架）

在 **elpis** 仓库：

```bash
npm link
```

在 **elpis-demo** 仓库（包名以 `package.json` 的 `name` 为准，当前为 `@zwl_11/elpis`）：

```bash
npm link @zwl_11/elpis
```

业务仓不要在本仓库写构建器。改框架后重新 link / 重启 `build:dev`，`.tpl` 才会按新逻辑生成。

### Vite 双终端启动（开发）

在 **elpis-demo** 开两个终端：

```bash
# 终端 1：Vite 出脚本 + HMR（9002）
npm run build:dev

# 终端 2：Koa 渲染 .tpl、提供 API（8080）
npm run dev
```

打开 `http://localhost:8080/view/auth/login`。页面由 8080 渲染，脚本从 `http://127.0.0.1:9002` 加载。

生产（无 9002）：

```bash
npm run build:prod   # 产物落到 app/public/dist/prod/
npm run prod         # 仅 Koa :8080，静态目录读 /dist/prod/
```

### 与 webpack 1.0 差异

| | webpack 1.0 | Vite 2.0 |
|--|--|--|
| 多入口 | 扫描框架 + 业务 `entry.*.js` 进 webpack `entry` | 同样扫两棵树，进 `rollupOptions.input` |
| 页面模板 | HtmlWebpackPlugin 写 `app/public/dist/{entry}.tpl` | `elpis-tpl-plugin` 写同一路径，仍给 Koa SSR，不是官方 `index.html` |
| 开发 | Express :9002 + webpack-dev-middleware | Vite Dev Server :9002；Koa 仍是 :8080（双进程不变） |
| `frontendBuild(env)` | `local` / `production` 分岔 webpack | **签名不变**；`local` → `app/vite/dev.js`，`production` → `app/vite/prod.js` |
| 业务 `import` | `$elpis*` / `$business*` alias | alias key 对齐，业务页路径零改 |

### Part1 完成 checklist

- [ ] M5：`curl -I http://127.0.0.1:9002/@vite/client` 200，浏览器有 HMR
- [ ] M7：8080 dashboard 全链路 CRUD（schema 增删改查）行为不比 1.0 少
- [ ] `app/webpack/` 已删除，`package.json` 无 webpack 构建依赖
- [ ] demo `build.js` / `server.js` 调用签名未改

### 自定义页面扩展

- 在 'app/pages/' 目录下写入口 entry.xxx.js

### dashboard / custom-view 自定义页面扩展

- 在 'app/pages/dashboard/xxxx' 下写页面

### dashboard / schema-view / components 动态组件扩展

- 1.在 'app/pages/dashboard/complex-view/schema-view/components' 下写组件
- 2.配置到 'app/pages/dashboard/complex-view/schema-view/components/component-config.js'

### schema-form 控件扩展

- 1.在 'app/pages/widgets/schema-form/complex-view' 下写控件
- 2.配置到 'app/pages/widgets/schema-form/form-item-config.js'

### schema-search-bar 控件扩展

- 1.在 'app/pages/widgets/schema-search-bar/complex-view' 下写控件
- 2.配置到 'app/pages/widgets/schema-search-bar/search-item-config.js'
