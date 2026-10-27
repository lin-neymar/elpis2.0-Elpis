/**
 * MemoryModule — 记忆层 Nest 模块
 * 职责：提供 ThreadService、CheckpointService 并导出。
 */
import { Module } from '@nestjs/common';
import { StoreModule } from '../store/store.module';
import { CheckpointService } from './checkpoint.service';
import { ThreadService } from './thread.service';

@Module({
  imports: [StoreModule],
  providers: [ThreadService, CheckpointService],
  exports: [ThreadService, CheckpointService],
})
export class MemoryModule {}
