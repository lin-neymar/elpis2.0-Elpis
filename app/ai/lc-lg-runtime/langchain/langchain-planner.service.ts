/**
 * LangChainPlannerService — LangChain 规划器
 * 职责：用 ChatOpenAI.bindTools 决定 toolCalls 或 finalAnswer。不引用 runtime/planner.service.ts。
 */
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../../config/config.service';
import { LlmMessage, LlmToolCall } from '../../llm/llm.interface';
import {
  AiLlmConfig,
  LlmBuiltinModelConfig,
  LlmCustomModelConfig,
} from '../../llm/internal/load-llm-config';

const PLACEHOLDER_API_KEY = 'xxxx';

export interface LangChainPlanInput {
  messages: LlmMessage[];
  tools: DynamicStructuredTool[];
  model?: string;
}

export interface LangChainToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LangChainPlanResult {
  toolCalls?: LangChainToolCall[];
  finalAnswer?: string;
  response: Record<string, unknown>;
}

@Injectable()
export class LangChainPlannerService {
  constructor(private readonly configService: ConfigService) {}

  async plan(input: LangChainPlanInput): Promise<LangChainPlanResult> {
    const llm = this.createChatModel(input.model);
    const runnable =
      input.tools.length > 0 ? llm.bindTools(input.tools) : llm;
    const aiMessage = await runnable.invoke(toLangChainMessages(input.messages));
    return toPlanResult(aiMessage);
  }

  private createChatModel(modelKey?: string): ChatOpenAI {
    const llm = this.loadLlmConfig();
    const key = modelKey?.trim() ? modelKey.trim() : llm.default;
    const modelConfig = llm.models[key];
    if (!modelConfig) {
      throw new Error(`[ai.llm] unknown model key "${key}"`);
    }
    if (isCustomModelConfig(modelConfig)) {
      throw new Error(
        `[langchain] model "${key}" cannot bindTools; use an openai-compatible model`,
      );
    }
    if (modelConfig.provider !== 'openai-compatible') {
      throw new Error(
        `[langchain] unsupported provider "${modelConfig.provider}" for model "${key}"`,
      );
    }
    if (!modelConfig.apiKey || modelConfig.apiKey === PLACEHOLDER_API_KEY) {
      throw new Error(
        `[ai.llm] models.${key}.apiKey is missing or still placeholder; set a real key in env config`,
      );
    }
    return new ChatOpenAI({
      model: modelConfig.model,
      apiKey: modelConfig.apiKey,
      configuration: { baseURL: modelConfig.baseURL },
      useResponsesApi: false,
    });
  }

  private loadLlmConfig(): AiLlmConfig {
    const ai = this.configService.get('ai') as { llm?: AiLlmConfig } | undefined;
    const llm = ai?.llm;
    if (!llm?.default || !llm.models) {
      throw new Error('[ai.llm] missing default or models in merged config');
    }
    return llm;
  }
}

function isCustomModelConfig(
  modelConfig: LlmBuiltinModelConfig | LlmCustomModelConfig,
): modelConfig is LlmCustomModelConfig {
  return typeof (modelConfig as LlmCustomModelConfig).use === 'function';
}

function toLangChainMessages(messages: LlmMessage[]) {
  return messages.map((message) => {
    if (message.role === 'system') {
      return new SystemMessage(message.content ?? '');
    }
    if (message.role === 'assistant') {
      return new AIMessage({
        content: message.content ?? '',
        tool_calls: (message.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function.name,
          args: parseArgs(call.function.arguments),
          type: 'tool_call' as const,
        })),
      });
    }
    if (message.role === 'tool') {
      return new ToolMessage({
        content: message.content ?? '',
        tool_call_id: message.tool_call_id ?? '',
      });
    }
    return new HumanMessage(message.content ?? '');
  });
}

function toPlanResult(message: AIMessage): LangChainPlanResult {
  const text = messageText(message.content);
  const toolCalls = (message.tool_calls ?? [])
    .filter((call) => typeof call.name === 'string' && call.name.trim())
    .map((call) => {
      const id = call.id?.trim() ? call.id : `call_${randomUUID()}`;
      const argumentsText = JSON.stringify(call.args ?? {});
      const llmCall: LlmToolCall = {
        id,
        type: 'function',
        function: { name: call.name, arguments: argumentsText },
      };
      return { id, name: call.name, arguments: argumentsText, llmCall };
    });

  if (toolCalls.length > 0) {
    const response: Record<string, unknown> = {
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls.map((call) => call.llmCall),
    };
    return {
      toolCalls: toolCalls.map(({ id, name, arguments: args }) => ({
        id,
        name,
        arguments: args,
      })),
      response,
    };
  }

  const response: Record<string, unknown> = {
    role: 'assistant',
    content: text,
  };
  return { finalAnswer: text, response };
}

function messageText(content: AIMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .join('');
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 交给模型侧下一轮看到原始字符串
  }
  return { raw };
}
