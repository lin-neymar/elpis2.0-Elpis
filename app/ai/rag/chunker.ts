/**
 * Chunker — 文档切分
 * 职责：按 ai.rag.chunk 等配置将原始文本切为可索引片段；供灌库与检索粒度调整，不含业务语料内容。
 */
import { randomUUID } from 'crypto';
import { Chunk, ChunkerLike } from './rag.interface';

export function chunkText(
  text: string,
  options: { size: number; overlap: number },
  meta?: Record<string, unknown>,
): Chunk[] {
  const docId =
    typeof meta?.docId === 'string' ? meta.docId : meta?.docId?.toString?.() ?? 'doc';
  const size = Math.max(1, options.size);
  const overlap = Math.min(Math.max(0, options.overlap), size - 1);
  const step = size - overlap;
  const chunks: Chunk[] = [];

  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return chunks;
  }

  for (let start = 0; start < normalized.length; start += step) {
    const slice = normalized.slice(start, start + size);
    if (!slice.trim()) {
      continue;
    }
    chunks.push({
      id: randomUUID(),
      docId,
      text: slice,
      meta,
    });
    if (start + size >= normalized.length) {
      break;
    }
  }

  return chunks;
}

export class DefaultChunker implements ChunkerLike {
  constructor(private readonly options: { size: number; overlap: number }) {}

  chunk(text: string, meta?: Record<string, unknown>): Chunk[] {
    return chunkText(text, this.options, meta);
  }
}

export function resolveChunker(options: {
  chunk: { size: number; overlap: number };
  chunker?: { use?: new () => ChunkerLike };
}): ChunkerLike {
  if (options.chunker?.use) {
    return new options.chunker.use();
  }
  return new DefaultChunker(options.chunk);
}
