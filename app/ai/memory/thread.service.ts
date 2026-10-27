/**
 * ThreadService — 对话线程
 * 职责：管理 threadId 与消息序列的读写，经 MemoryStore 持久化；支持跨请求追问与重启后恢复。
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../config/config.service';
import { LlmMessage } from '../llm/llm.interface';
import {
  MemoryEntry,
  MemoryMessage,
  ThreadCheckpoint,
} from '../store/store.interface';
import { resolveMemoryMaxTurns } from './internal/load-memory-config';

@Injectable()
export class ThreadService {
  constructor(private readonly configService: ConfigService) {}

  createThread(): string {
    return randomUUID();
  }

  ensureThread(threadId?: string): string {
    if (typeof threadId === 'string' && threadId.trim()) {
      return threadId.trim();
    }
    return this.createThread();
  }

  buildContextMessages(checkpoint: ThreadCheckpoint): LlmMessage[] {
    return checkpoint.messages.map((item) => ({
      role: item.role,
      content: item.content,
    }));
  }

  truncate(messages: MemoryMessage[], maxTurns?: number): MemoryEntry[] {
    const limit = maxTurns ?? resolveMemoryMaxTurns(this.configService);
    if (messages.length <= limit) {
      return [...messages];
    }
    return messages.slice(-limit);
  }

  appendTurn(
    checkpoint: ThreadCheckpoint,
    user: string,
    assistant: string,
  ): ThreadCheckpoint {
    const messages: MemoryMessage[] = [
      ...checkpoint.messages,
      { role: 'user', content: user },
      { role: 'assistant', content: assistant },
    ];
    const maxTurns = resolveMemoryMaxTurns(this.configService);
    return {
      threadId: checkpoint.threadId,
      messages: this.truncate(messages, maxTurns),
      updatedAt: Date.now(),
    };
  }

  emptyCheckpoint(threadId: string): ThreadCheckpoint {
    return {
      threadId,
      messages: [],
      updatedAt: Date.now(),
    };
  }
}
