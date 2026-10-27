/**
 * CheckpointService — 检查点快照
 * 职责：在 Orchestrator 关键节点保存/加载 checkpoint，与 ThreadService 配合恢复上下文状态。
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  MEMORY_STORE,
  MemoryStore,
  ThreadCheckpoint,
} from '../store/store.interface';

@Injectable()
export class CheckpointService {
  constructor(@Inject(MEMORY_STORE) private readonly memoryStore: MemoryStore) {}

  async load(threadId: string): Promise<ThreadCheckpoint | null> {
    return this.memoryStore.load(threadId);
  }

  async save(checkpoint: ThreadCheckpoint): Promise<void> {
    await this.memoryStore.save(checkpoint);
  }
}
