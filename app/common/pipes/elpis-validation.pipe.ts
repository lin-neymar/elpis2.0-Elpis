import { ValidationPipe } from '@nestjs/common';
import { createValidationException } from '../validation/create-validation-exception';

/**
 * 全局参数校验：与 1.0 api-params-verify + router-schema 对齐。
 * 各模块在 src/modules/<name>/dto/ 下为接口声明 class DTO（query / body），
 * Controller 使用 @Query() / @Body() 注入，字段名与 router-schema 一致（含下划线）。
 */
export function createElpisValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    forbidUnknownValues: false,
    validationError: {
      target: false,
      value: false,
    },
    exceptionFactory: (errors) => createValidationException(errors),
  });
}
