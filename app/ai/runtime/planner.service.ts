/**
 * PlannerService — 规划器
 * 职责：根据 Agent 声明与用户输入决定下一步（调 skill/tool、继续对话或结束）；可对接 LangChain/LangGraph 等实现。
 */
import { Injectable } from '@nestjs/common';
import { LlmGateway } from '../llm/llm.gateway';
import { LlmMessage, LlmToolCall } from '../llm/llm.interface';
import { PlanResult, PlanToolCall } from './runtime.types';

export interface PlanInput {
  messages: LlmMessage[];
  tools?: unknown;
  model?: string;
}

@Injectable()
export class PlannerService {
  constructor(private readonly llmGateway: LlmGateway) {}

  async plan(input: PlanInput): Promise<PlanResult> {
    const completion = await this.llmGateway.complete({
      messages: input.messages,
      tools: input.tools,
      model: input.model,
      stream: false,
    });

    const message = completion.message;
    const response: Record<string, unknown> = {
      role: 'assistant',
      content: message.content ?? null,
    };

    if (message.tool_calls?.length) {
      response.tool_calls = message.tool_calls;
      const toolCalls = this.mapToolCalls(message.tool_calls);
      return {
        action: 'tool',
        response,
        toolCalls,
        toolCallId: toolCalls[0]?.id,
      };
    }

    const fallback = this.parsePromptJsonFallback(message.content ?? '');
    if (fallback) {
      response.content = fallback.response.content;
      response.tool_calls = fallback.response.tool_calls;
      return fallback.plan;
    }

    return {
      action: 'final',
      response: {
        role: 'assistant',
        content: message.content ?? '',
      },
    };
  }

  private mapToolCalls(toolCalls: LlmToolCall[]): PlanToolCall[] {
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  private parsePromptJsonFallback(content: string): {
    plan: PlanResult;
    response: Record<string, unknown>;
  } | null {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed) as {
        action?: string;
        tool?: string;
        name?: string;
        input?: unknown;
        arguments?: unknown;
      };
      const toolName = parsed.tool ?? parsed.name;
      if (parsed.action !== 'tool' || !toolName) {
        return null;
      }
      const args = parsed.arguments ?? parsed.input ?? {};
      const id = `call_fallback_${Date.now()}`;
      const toolCall: LlmToolCall = {
        id,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      };
      const response: Record<string, unknown> = {
        role: 'assistant',
        content: null,
        tool_calls: [toolCall],
      };
      return {
        plan: {
          action: 'tool',
          response,
          toolCalls: [{ id, name: toolName, arguments: toolCall.function.arguments }],
          toolCallId: id,
        },
        response,
      };
    } catch {
      return null;
    }
  }
}
