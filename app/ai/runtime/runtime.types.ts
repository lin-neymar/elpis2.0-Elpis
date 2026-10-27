export const MAX_ITERATIONS = 5;

export type StepType = 'plan' | 'skill' | 'tool' | 'observe' | 'final' | 'guardrail';

export interface Step {
  type: StepType;
  round: number;
  [key: string]: unknown;
}

export type PlanAction = 'final' | 'tool';

export interface PlanToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface PlanResult {
  action: PlanAction;
  /** LLM 原始 assistant 消息，供 Orchestrator push */
  response: Record<string, unknown>;
  toolCalls?: PlanToolCall[];
  toolCallId?: string;
}

export interface RunResult {
  runId: string;
  output: string;
  steps: Step[];
  threadId: string;
}

export interface ExecutorResult {
  ok: boolean;
  kind?: 'skill' | 'tool';
  result?: unknown;
  error?: string;
  source?: 'builtin' | 'mcp';
}
