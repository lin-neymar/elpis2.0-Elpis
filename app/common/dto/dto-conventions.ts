/**
 * DTO 约定（auth / user / product 等待迁 API 复用 project 模式）：
 * - 每个接口独立 class 文件，如 get-user-query.dto.ts、login-body.dto.ts
 * - 使用 class-validator 装饰器；必填/类型与 app/router-schema/*.js 一致
 * - Controller：@Query() / @Body() + 对应 DTO，不在 handler 内手写 if 校验
 */

export {};
