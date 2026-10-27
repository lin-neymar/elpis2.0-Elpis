/**
 * HTTP 兼容 chat/completions 适配器（SSE 与非流式）
 */
import {
  LlmAssistantMessage,
  LlmChatOptions,
  LlmCompletionResult,
  LlmProvider,
} from '../llm.interface';

export interface OpenAiCompatibleConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private readonly cfg: OpenAiCompatibleConfig) {}

  async chat(options: LlmChatOptions): Promise<string> {
    const { message } = await this.complete(options);
    return message.content ?? '';
  }

  async complete(options: LlmChatOptions): Promise<LlmCompletionResult> {
    const url = this.completionsUrl();
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(options, false)),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `LLM chat/completions failed (${response.status}): ${detail}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: LlmAssistantMessage }>;
    };
    const message = payload.choices?.[0]?.message ?? {
      role: 'assistant',
      content: '',
    };
    return { message };
  }

  async *stream(options: LlmChatOptions): AsyncGenerator<string> {
    const url = this.completionsUrl();
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(options, true)),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `LLM chat/completions stream failed (${response.status}): ${detail}`,
      );
    }

    if (!response.body) {
      throw new Error('LLM stream response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]' || data === '') {
          continue;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // 跳过无法解析的 SSE 行
        }
      }
    }
  }

  private completionsUrl(): string {
    return `${this.cfg.baseURL.replace(/\/$/, '')}/chat/completions`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  private buildBody(options: LlmChatOptions, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: options.messages,
      stream,
    };
    if (options.tools !== undefined) {
      body.tools = options.tools;
    }
    return body;
  }
}
