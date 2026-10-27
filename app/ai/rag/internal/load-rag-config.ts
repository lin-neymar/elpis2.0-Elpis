import * as path from 'path';
import { ConfigService } from '../../../config/config.service';
import { RagOptions } from '../rag.interface';

const DEFAULT_RAG_OPTIONS: Required<
  Pick<RagOptions, 'chunk' | 'topK' | 'tool'>
> = {
  chunk: { size: 500, overlap: 50 },
  topK: 5,
  tool: {
    name: 'retrieve',
    description:
      '从私有知识库检索相关片段；回答必须引用返回的 docId/text',
  },
};

export function resolveRagOptions(configService: ConfigService): RagOptions {
  const ai = configService.get('ai') as { rag?: RagOptions } | undefined;
  const raw = ai?.rag ?? {};
  return {
    chunk: {
      size: raw.chunk?.size ?? DEFAULT_RAG_OPTIONS.chunk.size,
      overlap: raw.chunk?.overlap ?? DEFAULT_RAG_OPTIONS.chunk.overlap,
    },
    topK: raw.topK ?? DEFAULT_RAG_OPTIONS.topK,
    tool: {
      name: raw.tool?.name ?? DEFAULT_RAG_OPTIONS.tool.name,
      description:
        raw.tool?.description ?? DEFAULT_RAG_OPTIONS.tool.description,
    },
    chunker: raw.chunker,
    fixtures: raw.fixtures,
  };
}

export function resolveRagFixturesPath(configService: ConfigService): string {
  const ai = configService.get('ai') as
    | {
        store?: { vector?: { fixturesPath?: string } | string };
        rag?: { fixtures?: { path?: string } };
      }
    | undefined;

  const fromStore = ai?.store?.vector;
  if (fromStore && typeof fromStore === 'object') {
    const fixturesPath = fromStore.fixturesPath;
    if (typeof fixturesPath === 'string' && fixturesPath.trim()) {
      return path.resolve(process.cwd(), fixturesPath);
    }
  }

  const fromRag = ai?.rag?.fixtures?.path;
  if (typeof fromRag === 'string' && fromRag.trim()) {
    return path.resolve(process.cwd(), fromRag);
  }

  return path.resolve(process.cwd(), 'data/rag/fixtures');
}
