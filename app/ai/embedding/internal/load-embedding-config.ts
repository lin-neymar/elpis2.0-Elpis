import { ConfigService } from '../../../config/config.service';
import { EmbeddingProvider } from '../embedding.interface';
import { OpenAiCompatibleEmbeddingProvider } from '../providers/openai-compatible-embedding';

export interface EmbeddingModelConfig {
  provider: string;
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface AiEmbeddingConfig {
  default: string;
  models: Record<string, EmbeddingModelConfig>;
}

const PLACEHOLDER_API_KEY = 'xxxx';

export function loadEmbeddingConfig(
  configService: ConfigService,
): AiEmbeddingConfig | null {
  const ai = configService.get('ai') as
    | { embedding?: AiEmbeddingConfig }
    | undefined;
  const embedding = ai?.embedding;
  if (!embedding?.default || !embedding.models) {
    return null;
  }
  return embedding;
}

export function resolveEmbeddingProvider(
  configService: ConfigService,
  modelKey?: string,
): EmbeddingProvider {
  const embedding = loadEmbeddingConfig(configService);
  if (!embedding) {
    throw new Error('[ai.embedding] missing default or models in merged config');
  }
  const key = modelKey ?? embedding.default;
  const modelConfig = embedding.models[key];
  if (!modelConfig) {
    throw new Error(`[ai.embedding] unknown model key "${key}"`);
  }
  const apiKey = modelConfig.apiKey;
  if (!apiKey || apiKey === PLACEHOLDER_API_KEY) {
    throw new Error(
      `[ai.embedding] models.${key}.apiKey is missing or still placeholder`,
    );
  }
  switch (modelConfig.provider) {
    case 'openai-compatible':
      return new OpenAiCompatibleEmbeddingProvider({
        baseURL: modelConfig.baseURL,
        model: modelConfig.model,
        apiKey,
      });
    default:
      throw new Error(
        `[ai.embedding] unsupported provider "${modelConfig.provider}" for model "${key}"`,
      );
  }
}
