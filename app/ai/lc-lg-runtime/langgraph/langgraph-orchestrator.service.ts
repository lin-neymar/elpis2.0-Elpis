/**
 * LangGraphOrchestratorService — HTTP 生产编排
 * 职责：Guardrail、Thread/Checkpoint、Trace 的位置与 T5 一致；循环交给 LangGraph。
 *       不改 runtime/orchestrator.service.ts，那个 while 仍可对照。
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../../config/config.service';
import { AgentScannerService } from '../../agent/agent-scanner.service';
import { GuardrailService } from '../../guardrail/guardrail.service';
import { LlmMessage } from '../../llm/llm.interface';
import { CheckpointService } from '../../memory/checkpoint.service';
import { ThreadService } from '../../memory/thread.service';
import { RunResult, Step } from '../../runtime/runtime.types';
import { SkillScannerService } from '../../skill/skill-scanner.service';
import { ToolRegistryService } from '../../tool/tool-registry.service';
import { TraceService } from '../../trace/trace.service';
import { toStructuredTools } from '../langchain/skill-tool.adapter';
import { LangChainPlannerService } from '../langchain/langchain-planner.service';
import { ExecutorService } from '../../runtime/executor.service';
import {
  compileAgentGraph,
  describeAgentGraph,
  graphRecursionCeiling,
} from './agent.graph';

export type RunStreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'step'; step: Step }
  | {
      type: 'done';
      runId: string;
      output: string;
      steps: Step[];
      threadId: string;
    };

const GRAPH_NODES = new Set(['plan', 'execute', 'observe']);

@Injectable()
export class LangGraphOrchestratorService {
  constructor(
    private readonly agentScanner: AgentScannerService,
    private readonly skillScanner: SkillScannerService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly planner: LangChainPlannerService,
    private readonly executor: ExecutorService,
    private readonly trace: TraceService,
    private readonly guardrail: GuardrailService,
    private readonly threadService: ThreadService,
    private readonly checkpointService: CheckpointService,
    private readonly configService: ConfigService,
  ) {}

  graph() {
    return describeAgentGraph();
  }

  async run(
    agentName: string,
    input: unknown,
    threadId?: string,
  ): Promise<RunResult> {
    let result: RunResult | undefined;
    for await (const event of this.runGenerator(agentName, input, threadId)) {
      if (event.type === 'done') {
        result = {
          runId: event.runId,
          output: event.output,
          steps: event.steps,
          threadId: event.threadId,
        };
      }
    }
    if (!result) {
      throw new Error('agent run did not complete');
    }
    return result;
  }

  runStream(
    agentName: string,
    input: unknown,
    threadId?: string,
  ): AsyncGenerator<RunStreamEvent> {
    return this.runGenerator(agentName, input, threadId);
  }

  private async *runGenerator(
    agentName: string,
    input: unknown,
    threadId?: string,
  ): AsyncGenerator<RunStreamEvent, void> {
    const agent = this.agentScanner.get(agentName);
    if (!agent) {
      throw new Error(`agent "${agentName}" not found`);
    }

    const userContent = this.formatUserInput(input);
    const guard = this.guardrail.check(userContent);
    if (!guard.safe) {
      const blocked = await this.blockRun(
        agentName,
        input,
        threadId,
        guard.reason,
      );
      yield { type: 'step', step: blocked.steps[0] };
      yield { type: 'done', ...blocked };
      return;
    }

    const resolvedThreadId = this.threadService.ensureThread(threadId);
    let checkpoint =
      (await this.checkpointService.load(resolvedThreadId)) ??
      this.threadService.emptyCheckpoint(resolvedThreadId);
    checkpoint = {
      ...checkpoint,
      messages: this.threadService.truncate(checkpoint.messages),
    };

    const history = this.threadService.buildContextMessages(checkpoint);

    const runId = randomUUID();
    const tools = toStructuredTools({
      skillScanner: this.skillScanner,
      toolRegistry: this.toolRegistry,
      skills: agent.skills,
      tools: agent.tools,
      runId,
    });
    const messages: LlmMessage[] = [
      { role: 'system', content: agent.prompt ?? '' },
      ...history,
      { role: 'user', content: userContent },
    ];

    await this.trace.createRun({
      runId,
      agentName,
      input,
      messages,
    });

    const { graph, maxIterations } = compileAgentGraph({
      configService: this.configService,
      planner: this.planner,
      executor: this.executor,
      tools,
      model: agent.model,
      runId,
    });

    const steps: Step[] = [];
    let output = '';
    let round = 0;
    let latestMessages = messages;

    const stream = await graph.stream(
      {
        messages,
        iteration: 0,
        maxIterations,
        output: '',
        finished: false,
        pendingToolCalls: [],
        executions: [],
        emittedSteps: [],
      },
      {
        streamMode: 'updates',
        recursionLimit: graphRecursionCeiling(maxIterations),
      },
    );

    for await (const chunk of stream) {
      for (const [nodeName, update] of Object.entries(
        chunk as unknown as Record<string, unknown>,
      )) {
        if (!update || typeof update !== 'object') {
          continue;
        }
        const partial = update as {
          messages?: LlmMessage[];
          emittedSteps?: Step[];
          output?: string;
        };
        if (Array.isArray(partial.messages)) {
          latestMessages = partial.messages;
        }
        const emitted = Array.isArray(partial.emittedSteps)
          ? partial.emittedSteps
          : [];
        for (const step of emitted) {
          const recorded = this.withNode(step, nodeName);
          if (typeof recorded.round === 'number') {
            round = recorded.round;
          }
          if (recorded.type === 'final') {
            output = String(recorded.output ?? '');
          }
          steps.push(recorded);
          await this.trace.addStep(runId, recorded);
          yield { type: 'step', step: recorded };
          if (recorded.type === 'final' && output) {
            yield { type: 'delta', delta: output };
          }
        }
        if (nodeName === 'observe') {
          await this.trace.updateMessages(runId, latestMessages);
        }
      }
    }

    if (!output) {
      output = `达到最大轮次 (${maxIterations})，未得到最终回复`;
      const finalStep: Step = { type: 'final', round, output };
      steps.push(finalStep);
      await this.trace.addStep(runId, finalStep);
      yield { type: 'step', step: finalStep };
    }

    await this.trace.finalize(runId, output);

    const savedCheckpoint = this.threadService.appendTurn(
      checkpoint,
      userContent,
      output,
    );
    await this.checkpointService.save(savedCheckpoint);

    yield {
      type: 'done',
      runId,
      output,
      steps,
      threadId: resolvedThreadId,
    };
  }

  private withNode(step: Step, nodeName: string): Step {
    if (!GRAPH_NODES.has(nodeName)) {
      return step;
    }
    const node = nodeName as 'plan' | 'execute' | 'observe';
    const next: Step = step.node ? step : { ...step, node };
    if (node === 'plan' && next.type === 'plan' && next.planner == null) {
      return { ...next, planner: 'langchain' };
    }
    return next;
  }

  private async blockRun(
    agentName: string,
    input: unknown,
    threadId: string | undefined,
    reason?: string,
  ): Promise<RunResult> {
    const runId = randomUUID();
    const output = reason
      ? `请求已被安全策略拦截：${reason}`
      : '请求已被安全策略拦截';
    const step: Step = {
      type: 'guardrail',
      round: 0,
      reason,
      output,
    };
    await this.trace.createRun({
      runId,
      agentName,
      input,
      messages: [],
    });
    await this.trace.addStep(runId, step);
    await this.trace.finalize(runId, output);
    return {
      runId,
      output,
      steps: [step],
      threadId: this.threadService.ensureThread(threadId),
    };
  }

  private formatUserInput(input: unknown): string {
    if (typeof input === 'string') {
      return input;
    }
    return JSON.stringify(input);
  }
}
