import { ConfigService } from '../../../config/config.service';
import { resolveRagOptions } from '../../rag/internal/load-rag-config';
import { RetrieverService } from '../../rag/retriever.service';
import { BuiltinToolFactory } from '../tool.interface';

const retrieveTool: BuiltinToolFactory = ({ moduleRef }) => {
  const configService = moduleRef.get(ConfigService, { strict: false });
  const retriever = moduleRef.get(RetrieverService, { strict: false });
  const ragOptions = resolveRagOptions(configService);
  const toolName = ragOptions.tool?.name ?? 'retrieve';
  const description =
    ragOptions.tool?.description ??
    '从私有知识库检索相关片段；回答必须引用返回的 docId/text';

  return {
    name: toolName,
    description,
    source: 'builtin' as const,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索问题或关键词' },
      },
      required: ['query'],
    },
    async execute(input: unknown) {
      const payload = input as { query?: string };
      const query = typeof payload?.query === 'string' ? payload.query : '';
      const result = await retriever.retrieve(query);
      return { hits: result.hits };
    },
  };
};

export default retrieveTool;
