/**
 * LlmGateway — 大模型统一门面
 * 职责：对外 chat / chatStream；按 demo ai.llm 选型并转发至 LlmProvider。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  resolveLlmProvider,
  resolveLlmStream,
} from './internal/load-llm-config';
import { OpenAiCompatibleProvider } from './providers/openai-compatible';
import { LlmChatOptions, LlmCompletionResult } from './llm.interface';

@Injectable()
export class LlmGateway {
  constructor(private readonly configService: ConfigService) {}

  async chat(options: LlmChatOptions): Promise<string> {
    const provider = resolveLlmProvider(this.configService, options.model);
    return provider.chat({ ...options, stream: false });
  }

  async complete(options: LlmChatOptions): Promise<LlmCompletionResult> {
    const provider = resolveLlmProvider(this.configService, options.model);
    if (provider instanceof OpenAiCompatibleProvider) {
      return provider.complete(options);
    }
    const text = await provider.chat({ ...options, stream: false });
    return this.completionFromText(text);
  }

  private completionFromText(text: string): LlmCompletionResult {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as {
          action?: string;
          tool?: string;
          name?: string;
          input?: unknown;
          arguments?: unknown;
        };
        const toolName = parsed.tool ?? parsed.name;
        if (parsed.action === 'tool' && toolName) {
          const args = parsed.arguments ?? parsed.input ?? {};
          return {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: `call_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: JSON.stringify(args),
                  },
                },
              ],
            },
          };
        }
      } catch {
        // fall through
      }
    }
    return { message: { role: 'assistant', content: text } };
  }

  stream(options: LlmChatOptions): AsyncGenerator<string> {
    const run = resolveLlmStream(this.configService, options.model);
    return run({ ...options, stream: true });
  }
}
