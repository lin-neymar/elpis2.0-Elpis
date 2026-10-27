/**
 * LangGraph Agent 状态
 * 职责：保存消息、轮次与本节点吐出的 steps。循环刹车读 state.iteration。
 */
import { Annotation } from '@langchain/langgraph';
import { LlmMessage } from '../../llm/llm.interface';
import { Step } from '../../runtime/runtime.types';

export interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolExecutionRecord {
  id: string;
  name: string;
  args: unknown;
  ok: boolean;
  kind?: 'skill' | 'tool';
  result?: unknown;
  error?: string;
  source?: 'builtin' | 'mcp';
}

export const AgentGraphAnnotation = Annotation.Root({
  messages: Annotation<LlmMessage[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  iteration: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (left, right) => (typeof right === 'number' ? right : left),
    default: () => 0,
  }),
  output: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => '',
  }),
  finished: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  pendingToolCalls: Annotation<PendingToolCall[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  executions: Annotation<ToolExecutionRecord[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  emittedSteps: Annotation<Step[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
});

export type AgentGraphState = typeof AgentGraphAnnotation.State;
