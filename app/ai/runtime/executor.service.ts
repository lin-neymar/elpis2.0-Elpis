/**
 * ExecutorService — 执行器
 * 职责：执行 Planner 选定的 skill/tool 调用，收集结果并写入 steps；处理错误与超时边界。
 */
import { Injectable } from '@nestjs/common';
import { SkillScannerService } from '../skill/skill-scanner.service';
import { ToolRegistryService } from '../tool/tool-registry.service';
import { ExecutorResult } from './runtime.types';

@Injectable()
export class ExecutorService {
  constructor(
    private readonly skillScanner: SkillScannerService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async execute(
    name: string,
    args: unknown,
    ctx: { runId: string },
  ): Promise<ExecutorResult> {
    const skill = this.skillScanner.get(name);
    if (skill) {
      try {
        const result = await this.skillScanner.invoke(name, args, {
          runId: ctx.runId,
        });
        return { ok: true, kind: 'skill', result };
      } catch (err) {
        return {
          ok: false,
          kind: 'skill',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const tool = this.toolRegistry.get(name);
    if (tool) {
      try {
        const result = await tool.execute(args, { runId: ctx.runId });
        return {
          ok: true,
          kind: 'tool',
          result,
          source: tool.source === 'mcp' ? 'mcp' : 'builtin',
        };
      } catch (err) {
        return {
          ok: false,
          kind: 'tool',
          error: err instanceof Error ? err.message : String(err),
          source: tool.source === 'mcp' ? 'mcp' : 'builtin',
        };
      }
    }

    return {
      ok: false,
      error: `unknown skill or tool "${name}"`,
    };
  }
}
