import { ConfigService } from '../../../config/config.service';
import { LlmChatOptions, LlmProvider } from '../llm.interface';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible';

/** demo config：HTTP 兼容通路 */
export interface LlmBuiltinModelConfig {
  provider: string;
  baseURL: string;
  model: string;
  apiKey: string;
}

/** demo config：require 自定义类并 use: MockProvider */
export interface LlmCustomModelConfig {
  use: new () => LlmProvider;
}

export type LlmModelConfig = LlmBuiltinModelConfig | LlmCustomModelConfig;

export interface AiLlmConfig {
  default: string;
  models: Record<string, LlmModelConfig>;
}

const PLACEHOLDER_API_KEY = 'xxxx';

type LlmProviderConstructor = new () => LlmProvider;

type LlmStreamableProvider = LlmProvider & {
  stream?(options: LlmChatOptions): AsyncGenerator<string>;
};

export function loadLlmConfig(configService: ConfigService): AiLlmConfig {
  const ai = configService.get('ai') as { llm?: AiLlmConfig } | undefined;
  const llm = ai?.llm;
  if (!llm?.default || !llm.models) {
    throw new Error('[ai.llm] missing default or models in merged config');
  }
  return llm;
}

function isCustomModelConfig(
  modelConfig: LlmModelConfig,
): modelConfig is LlmCustomModelConfig {
  return typeof (modelConfig as LlmCustomModelConfig).use === 'function';
}

function instantiateCustomProvider(
  use: LlmProviderConstructor,
  modelKey: string,
): LlmProvider {
  const instance = new use();
  if (!instance || typeof instance.chat !== 'function') {
    throw new Error(
      `[ai.llm] models.${modelKey}.use must implement LlmProvider.chat`,
    );
  }
  return instance;
}

function resolveBuiltinProvider(
  modelConfig: LlmBuiltinModelConfig,
  modelKey: string,
): LlmProvider {
  const apiKey = modelConfig.apiKey;
  if (!apiKey || apiKey === PLACEHOLDER_API_KEY) {
    throw new Error(
      `[ai.llm] models.${modelKey}.apiKey is missing or still placeholder; set a real key in env config`,
    );
  }

  switch (modelConfig.provider) {
    case 'openai-compatible':
      return new OpenAiCompatibleProvider({
        baseURL: modelConfig.baseURL,
        model: modelConfig.model,
        apiKey,
      });
    default:
      throw new Error(
        `[ai.llm] unsupported provider "${modelConfig.provider}" for model "${modelKey}"`,
      );
  }
}

export function resolveLlmProvider(
  configService: ConfigService,
  modelKey?: string,
): LlmProvider {
  const llm = loadLlmConfig(configService);
  const key = modelKey ?? llm.default;
  const modelConfig = llm.models[key];
  if (!modelConfig) {
    throw new Error(`[ai.llm] unknown model key "${key}"`);
  }

  if (isCustomModelConfig(modelConfig)) {
    return instantiateCustomProvider(modelConfig.use, key);
  }

  return resolveBuiltinProvider(modelConfig, key);
}

export function resolveLlmStream(
  configService: ConfigService,
  modelKey?: string,
): (options: LlmChatOptions) => AsyncGenerator<string> {
  const provider = resolveLlmProvider(configService, modelKey);

  if (provider instanceof OpenAiCompatibleProvider) {
    return (options) => provider.stream(options);
  }

  const streamable = provider as LlmStreamableProvider;
  if (typeof streamable.stream === 'function') {
    return (options) => streamable.stream!(options);
  }

  return async function* (options: LlmChatOptions) {
    const text = await provider.chat(options);
    if (text) {
      yield text;
    }
  };
}
