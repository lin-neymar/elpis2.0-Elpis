/**
 * GuardrailModule — 输入拦截 Nest 模块
 * 职责：提供 GuardrailService 并导出。
 */
import { Module } from '@nestjs/common';
import { GuardrailService } from './guardrail.service';

@Module({
  providers: [GuardrailService],
  exports: [GuardrailService],
})
export class GuardrailModule {}
