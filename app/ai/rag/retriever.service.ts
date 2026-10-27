/**
 * RetrieverService — RAG 检索
 * 职责：对用户问题做向量检索（经 EmbeddingGateway + VectorStore），返回命中片段与出处 metadata 供 LLM 与 steps 展示。
 */
import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import glob = require('glob');
import { ConfigService } from '../../config/config.service';
import { EmbeddingGateway } from '../embedding/embedding.gateway';
import {
  VECTOR_STORE,
  VectorQueryHit,
  VectorRecord,
  VectorStore,
} from '../store/store.interface';
import { resolveChunker } from './chunker';
import {
  resolveRagFixturesPath,
  resolveRagOptions,
} from './internal/load-rag-config';
import { Chunk } from './rag.interface';

export interface IngestResult {
  ingested: number;
  chunks: number;
}

export interface RetrieveResult {
  hits: VectorQueryHit[];
}

@Injectable()
export class RetrieverService {
  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingGateway: EmbeddingGateway,
    @Inject(VECTOR_STORE) private readonly vectorStore: VectorStore,
  ) {}

  async ingestFromDirectory(dir: string): Promise<IngestResult> {
    const absoluteDir = path.resolve(dir);
    if (!fs.existsSync(absoluteDir)) {
      throw new Error(`ingest directory not found: ${absoluteDir}`);
    }

    const ragOptions = resolveRagOptions(this.configService);
    const chunker = resolveChunker({
      chunk: ragOptions.chunk!,
      chunker: ragOptions.chunker,
    });

    const files = glob
      .sync('**/*.{txt,md}', { cwd: absoluteDir, nodir: true })
      .sort();
    let ingested = 0;
    let chunkCount = 0;
    const batch: VectorRecord[] = [];

    for (const relativePath of files) {
      const fullPath = path.join(absoluteDir, relativePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const docId = relativePath.replace(/\\/g, '/');
      const chunks: Chunk[] = chunker.chunk(content, { docId, path: docId });
      if (!chunks.length) {
        continue;
      }
      ingested += 1;
      chunkCount += chunks.length;

      const embeddings = await this.embeddingGateway.embed(
        chunks.map((item) => item.text),
      );
      for (let i = 0; i < chunks.length; i += 1) {
        batch.push({
          id: chunks[i].id,
          docId: chunks[i].docId,
          text: chunks[i].text,
          embedding: embeddings[i] ?? [],
          meta: chunks[i].meta,
        });
      }
    }

    if (batch.length) {
      await this.vectorStore.upsert(batch);
    }

    return { ingested, chunks: chunkCount };
  }

  async retrieve(query: string, topK?: number): Promise<RetrieveResult> {
    const ragOptions = resolveRagOptions(this.configService);
    const k = topK ?? ragOptions.topK ?? 5;
    const trimmed = query.trim();
    if (!trimmed) {
      return { hits: [] };
    }
    const [embedding] = await this.embeddingGateway.embed([trimmed]);
    const hits = await this.vectorStore.query(embedding ?? [], k);
    return { hits };
  }

  resolveDefaultFixturesPath(): string {
    return resolveRagFixturesPath(this.configService);
  }
}
