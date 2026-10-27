/**
 * ToolModule — Tool 层 Nest 模块
 * 职责：提供并导出 ToolRegistryService；内置 tool 含 service_invoke 与 retrieve（依赖 RagModule）。
 */
import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { ToolRegistryService } from './tool-registry.service';

@Module({
  imports: [RagModule],
  providers: [ToolRegistryService],
  exports: [ToolRegistryService],
})
export class ToolModule {}
