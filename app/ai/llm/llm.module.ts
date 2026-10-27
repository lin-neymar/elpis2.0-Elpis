/**
 * LlmModule — 大模型层 Nest 模块
 * 职责：提供并导出 LlmGateway；后续在此注册默认 Provider 与 demo 注入的 Provider。
 */
import { Module } from '@nestjs/common';
import { LlmGateway } from './llm.gateway';

@Module({
  providers: [LlmGateway],
  exports: [LlmGateway],
})
export class LlmModule {}
