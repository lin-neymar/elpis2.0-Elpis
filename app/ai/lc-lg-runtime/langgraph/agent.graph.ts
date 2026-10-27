/**
 * LangGraph 循环
 * 职责：plan → execute → observe，条件边回到 plan；上限来自 resolveMaxIterations，用 state.iteration 刹车。
 */
import { END, START, StateGraph } from '@langchain/langgraph';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '../../../config/config.service';
import { LlmMessage } from '../../llm/llm.interface';
import { ExecutorService } from '../../runtime/executor.service';
import { Step } from '../../runtime/runtime.types';
import { resolveMaxIterations } from '../internal/load-runtime-config';
import { LangChainPlannerService } from '../langchain/langchain-planner.service';
import {
  AgentGraphAnnotation,
  AgentGraphState,
  PendingToolCall,
  ToolExecutionRecord,
} from './agent.state';

export interface AgentGraphDeps {
  configService: ConfigService;
  planner: LangChainPlannerService;
  executor: ExecutorService;
  tools: DynamicStructuredTool[];
  model?: string;
  runId: string;
}

export function describeAgentGraph(): {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
} {
  return {
    nodes: ['plan', 'execute', 'observe'],
    edges: [
      { from: START, to: 'plan' },
      { from: 'plan', to: 'execute' },
      { from: 'plan', to: END },
      { from: 'execute', to: 'observe' },
      { from: 'observe', to: 'plan' },
      { from: 'observe', to: END },
    ],
  };
}

/** LangGraph recursionLimit 按节点访问计数，只作天花板，不代替 iteration 刹车。 */
export function graphRecursionCeiling(maxIterations: number): number {
  return maxIterations * 4 + 2;
}

export function compileAgentGraph(deps: AgentGraphDeps) {
  const maxIterations = resolveMaxIterations(deps.configService);
  const graph = new StateGraph(AgentGraphAnnotation)
    .addNode('plan', (state) => planNode(state, deps))
    .addNode('execute', (state) => executeNode(state, deps))
    .addNode('observe', (state) => observeNode(state))
    .addEdge(START, 'plan')
    .addConditionalEdges('plan', routeAfterPlan, ['execute', END])
    .addEdge('execute', 'observe')
    .addConditionalEdges('observe', routeAfterObserve, ['plan', END])
    .compile();
  return { graph, maxIterations };
}

function routeAfterPlan(state: AgentGraphState): 'execute' | typeof END {
  if (state.finished || state.pendingToolCalls.length === 0) {
    return END;
  }
  return 'execute';
}

function routeAfterObserve(state: AgentGraphState): 'plan' | typeof END {
  if (state.finished || state.iteration >= state.maxIterations) {
    return END;
  }
  return 'plan';
}

async function planNode(
  state: AgentGraphState,
  deps: AgentGraphDeps,
): Promise<Partial<AgentGraphState>> {
  const round = state.iteration + 1;
  const plan = await deps.planner.plan({
    messages: state.messages,
    tools: deps.tools,
    model: deps.model,
  });
  const messages: LlmMessage[] = [
    ...state.messages,
    plan.response as unknown as LlmMessage,
  ];
  const planStep: Step = {
    type: 'plan',
    round,
    node: 'plan',
    planner: 'langchain',
    action: plan.toolCalls?.length ? 'tool' : 'final',
    response: plan.response,
  };

  if (!plan.toolCalls?.length) {
    const output = plan.finalAnswer ?? '';
    const finalStep: Step = {
      type: 'final',
      round,
      node: 'plan',
      output,
    };
    return {
      iteration: round,
      messages,
      output,
      finished: true,
      pendingToolCalls: [],
      emittedSteps: [planStep, finalStep],
    };
  }

  return {
    iteration: round,
    messages,
    finished: false,
    pendingToolCalls: plan.toolCalls,
    emittedSteps: [planStep],
  };
}

async function executeNode(
  state: AgentGraphState,
  deps: AgentGraphDeps,
): Promise<Partial<AgentGraphState>> {
  const executions: ToolExecutionRecord[] = [];
  const emittedSteps: Step[] = [];

  for (const call of state.pendingToolCalls) {
    const args = parseToolArgs(call);
    const execResult = await deps.executor.execute(call.name, args, {
      runId: deps.runId,
    });
    executions.push({
      id: call.id,
      name: call.name,
      args,
      ok: execResult.ok,
      kind: execResult.kind,
      result: execResult.result,
      error: execResult.error,
      source: execResult.source,
    });
    const execType =
      execResult.kind === 'skill'
        ? 'skill'
        : execResult.kind === 'tool'
          ? 'tool'
          : 'observe';
    emittedSteps.push({
      type: execType,
      round: state.iteration,
      node: 'execute',
      name: call.name,
      input: args,
      result: execResult.result,
      error: execResult.error,
      source: execResult.source,
    });
  }

  return { executions, emittedSteps };
}

function observeNode(state: AgentGraphState): Partial<AgentGraphState> {
  const emittedSteps: Step[] = state.executions.map((execution) => ({
    type: 'observe',
    round: state.iteration,
    node: 'observe',
    toolCallId: execution.id,
    content: execution.ok ? execution.result : execution.error,
  }));
  const toolMessages: LlmMessage[] = state.executions.map((execution) => ({
    role: 'tool',
    tool_call_id: execution.id,
    content: JSON.stringify(
      execution.ok ? execution.result : { error: execution.error },
    ),
  }));
  return {
    messages: [...state.messages, ...toolMessages],
    emittedSteps,
  };
}

function parseToolArgs(call: PendingToolCall): unknown {
  try {
    return JSON.parse(call.arguments || '{}');
  } catch {
    return { raw: call.arguments };
  }
}
