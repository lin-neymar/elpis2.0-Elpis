/**
 * RagModule — 检索增强 Nest 模块
 * 职责：装配 Chunker、RetrieverService 并导出。
 */
import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../embedding/embedding.module';
import { StoreModule } from '../store/store.module';
import { RetrieverService } from './retriever.service';

@Module({
  imports: [EmbeddingModule, StoreModule],
  providers: [RetrieverService],
  exports: [RetrieverService],
})
export class RagModule {}
