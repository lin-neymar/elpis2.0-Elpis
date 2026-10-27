/**
 * TraceService — Run 追踪与回放
 * 职责：通过 TraceStore 持久化 steps 与事件；支持按 runId 查询，供 Trace 页与调试使用。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Step } from '../runtime/runtime.types';
import { TRACE_STORE, TraceRun, TraceStore } from '../store/store.interface';

@Injectable()
export class TraceService {
  constructor(@Inject(TRACE_STORE) private readonly traceStore: TraceStore) {}

  async createRun(params: {
    runId: string;
    agentName: string;
    input: unknown;
    messages: unknown[];
  }): Promise<TraceRun> {
    const now = new Date().toISOString();
    const run: TraceRun = {
      runId: params.runId,
      agentName: params.agentName,
      input: params.input,
      steps: [],
      messages: params.messages,
      createdAt: now,
      updatedAt: now,
    };
    await this.traceStore.save(run);
    return run;
  }

  async addStep(runId: string, step: Step): Promise<void> {
    const run = await this.traceStore.load(runId);
    if (!run) {
      return;
    }
    run.steps.push(step);
    run.updatedAt = new Date().toISOString();
    await this.traceStore.save(run);
  }

  async updateMessages(runId: string, messages: unknown[]): Promise<void> {
    const run = await this.traceStore.load(runId);
    if (!run) {
      return;
    }
    run.messages = messages;
    run.updatedAt = new Date().toISOString();
    await this.traceStore.save(run);
  }

  async finalize(runId: string, output: string): Promise<void> {
    const run = await this.traceStore.load(runId);
    if (!run) {
      return;
    }
    run.output = output;
    run.updatedAt = new Date().toISOString();
    await this.traceStore.save(run);
  }

  async load(runId: string): Promise<TraceRun | null> {
    return this.traceStore.load(runId);
  }
}
