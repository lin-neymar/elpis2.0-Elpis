# Part2 tasks · Koa → 全 Nest

> 任务板。一节课只执行一条。
> implement = 先读本目录三件套，再贴当前这一条的施工单。施工单正文不改，不追加口语。

| 任务 | 完成标准 |
|------|----------|
| T1 nest-demo 练三角 · 禁过渡桥 | nest-demo Hello；三角 Module/Controller/Service |
| T2 请求管道 · 迁移对照表 | Guard / Pipe / Filter；1.0 → Nest 字典 |
| T3 serverStart 换 Nest | NestFactory；`serverStart` 后 8080 监听 |
| T4 Project 三接口 | `/api/project` 三接口 curl 与 1.0 一致 |
| T5 横切挂点 · View · 静态 | 返回格式/验签/442；dashboard 8080 页面；静态兜底 |
| T6 demo 业务迁移 · 删 Koa | Auth/User/Product；回归；删 Koa |

## T6 收尾（Part2 关单）

| 子项 | 完成标准 |
|------|----------|
| T6-a 删 Koa 残留 | demo 无 `controller/`、`router/`、`middleware/`、`router-schema/`；框架无 Koa 内核 |
| T6-b 业务 dist 契约 | 仅 `app/modules` → `dist/modules`；`build:modules` 前清空 `dist/modules`，无无源 `.module.js` 被扫描 |
| T6-c 业务仓真源 | **elpis2.0-demo** 为 Part2 业务真源；同级 `elpis-demo` 不维护、不引用 |
| T6-d 模块加载 | `loadBusinessModules()` 字母序注册；`FallbackModule` 在框架侧最后；见 plan「业务模块扫描」 |
| T6-e 回归 | 登录 / Auth·User·Product API；442/445/446/50000；8080 页面 + 9002 脚本（双终端） |

走偏了回到 spec.md / plan.md，不追加口语 Prompt。
