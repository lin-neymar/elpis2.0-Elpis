/**
 * EmbeddingGateway — 文本向量化门面
 * 职责：统一调用 embedding Provider，为 RAG 灌库、向量检索与记忆检索提供向量；不含业务字段含义。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { resolveEmbeddingProvider } from './internal/load-embedding-config';

@Injectable()
export class EmbeddingGateway {
  constructor(private readonly configService: ConfigService) {}

  async embed(texts: string[], modelKey?: string): Promise<number[][]> {
    const provider = resolveEmbeddingProvider(this.configService, modelKey);
    return provider.embed(texts);
  }
}
