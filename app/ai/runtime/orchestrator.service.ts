/**
 * OrchestratorService — Agent 运行编排核心
 * 职责：驱动多轮 plan→execute 循环，组装 runId / output / steps；对接流式事件与 Trace、Guardrail、Memory。
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgentScannerService } from '../agent/agent-scanner.service';
import { GuardrailService } from '../guardrail/guardrail.service';
import { LlmMessage } from '../llm/llm.interface';
import { CheckpointService } from '../memory/checkpoint.service';
import { ThreadService } from '../memory/thread.service';
import { SkillScannerService } from '../skill/skill-scanner.service';
import { ToolRegistryService } from '../tool/tool-registry.service';
import { TraceService } from '../trace/trace.service';
import { ExecutorService } from './executor.service';
import { PlannerService } from './planner.service';
import {
  MAX_ITERATIONS,
  RunResult,
  Step,
} from './runtime.types';

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

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly agentScanner: AgentScannerService,
    private readonly skillScanner: SkillScannerService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly planner: PlannerService,
    private readonly executor: ExecutorService,
    private readonly trace: TraceService,
    private readonly guardrail: GuardrailService,
    private readonly threadService: ThreadService,
    private readonly checkpointService: CheckpointService,
  ) {}

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
    const tools = this.buildTools(agent.skills, agent.tools);
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

    const steps: Step[] = [];
    let output = '';
    let round = 0;

    while (round < MAX_ITERATIONS) {
      round += 1;

      const plan = await this.planner.plan({
        messages,
        tools,
        model: agent.model,
      });

      const planStep: Step = {
        type: 'plan',
        round,
        action: plan.action,
        response: plan.response,
      };
      steps.push(planStep);
      await this.trace.addStep(runId, planStep);
      yield { type: 'step', step: planStep };

      messages.push(plan.response as unknown as LlmMessage);

      if (plan.action === 'final') {
        output = String(plan.response.content ?? '');
        const finalStep: Step = { type: 'final', round, output };
        steps.push(finalStep);
        await this.trace.addStep(runId, finalStep);
        yield { type: 'step', step: finalStep };
        if (output) {
          yield { type: 'delta', delta: output };
        }
        break;
      }

      const toolCalls = plan.toolCalls ?? [];
      for (const tc of toolCalls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(tc.arguments || '{}');
        } catch {
          parsedArgs = { raw: tc.arguments };
        }

        const execResult = await this.executor.execute(tc.name, parsedArgs, {
          runId,
        });

        const execType =
          execResult.kind === 'skill'
            ? 'skill'
            : execResult.kind === 'tool'
              ? 'tool'
              : 'observe';

        const execStep: Step = {
          type: execType,
          round,
          name: tc.name,
          input: parsedArgs,
          result: execResult.result,
          error: execResult.error,
          source: execResult.source,
        };
        steps.push(execStep);
        await this.trace.addStep(runId, execStep);
        yield { type: 'step', step: execStep };

        const observeStep: Step = {
          type: 'observe',
          round,
          toolCallId: tc.id,
          content: execResult.ok ? execResult.result : execResult.error,
        };
        steps.push(observeStep);
        await this.trace.addStep(runId, observeStep);
        yield { type: 'step', step: observeStep };

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(
            execResult.ok ? execResult.result : { error: execResult.error },
          ),
        });
      }

      await this.trace.updateMessages(runId, messages);
    }

    if (!output) {
      output = `达到最大轮次 (${MAX_ITERATIONS})，未得到最终回复`;
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

  private buildTools(skills: string[], tools: string[]) {
    const allowed = new Set([...skills, ...tools]);
    const payload: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }> = [];

    for (const item of this.skillScanner.toToolsPayload()) {
      if (allowed.has(item.function.name)) {
        payload.push(item);
      }
    }
    for (const item of this.toolRegistry.list()) {
      if (allowed.has(item.name)) {
        payload.push({
          type: 'function',
          function: {
            name: item.name,
            description: item.description,
            parameters: item.inputSchema,
          },
        });
      }
    }
    return payload;
  }

  private formatUserInput(input: unknown): string {
    if (typeof input === 'string') {
      return input;
    }
    return JSON.stringify(input);
  }
}
