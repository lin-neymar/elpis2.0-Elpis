/**
 * LLM 契约类型
 * 职责：定义对话消息、请求选项与 LlmProvider 接口；选型来自 demo config.ai.llm，实现装配在后续步骤。
 */
export interface LlmMessage {
  role: string;
  content?: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
}

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmAssistantMessage {
  role: 'assistant';
  content?: string | null;
  tool_calls?: LlmToolCall[];
}

export interface LlmCompletionResult {
  message: LlmAssistantMessage;
}

export interface LlmChatOptions {
  model?: string;
  tools?: unknown;
  stream?: boolean;
  messages: LlmMessage[];
}

export interface LlmProvider {
  chat(options: LlmChatOptions): Promise<string>;
}
