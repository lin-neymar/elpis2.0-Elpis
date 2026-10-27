/**
 * StoreModule — 持久化抽象层 Nest 模块
 * 职责：绑定 TraceStore / MemoryStore / VectorStore 的 DI Token 与 demo 提供的实现类。
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  resolveMemoryStorePath,
  resolveTraceStorePath,
  resolveVectorStorePath,
} from './internal/load-store-config';
import { FileMemoryStore } from './reference/file-memory.store';
import { FileTraceStore } from './reference/file-trace.store';
import { FileVectorStore } from './reference/file-vector.store';
import { MEMORY_STORE, TRACE_STORE, VECTOR_STORE } from './store.interface';

@Module({
  providers: [
    {
      provide: TRACE_STORE,
      useFactory: (configService: ConfigService) => {
        const rootDir = resolveTraceStorePath(configService);
        return new FileTraceStore(rootDir);
      },
      inject: [ConfigService],
    },
    {
      provide: VECTOR_STORE,
      useFactory: (configService: ConfigService) => {
        const rootDir = resolveVectorStorePath(configService);
        return new FileVectorStore(rootDir);
      },
      inject: [ConfigService],
    },
    {
      provide: MEMORY_STORE,
      useFactory: (configService: ConfigService) => {
        const rootDir = resolveMemoryStorePath(configService);
        return new FileMemoryStore(rootDir);
      },
      inject: [ConfigService],
    },
  ],
  exports: [TRACE_STORE, VECTOR_STORE, MEMORY_STORE],
})
export class StoreModule {}
