/**
 * AiController — /api/ai/* HTTP 入口
 * 职责：暴露 chat、agent/run、流式、tool/agent 列表、trace 等 REST/SSE 端点；
 *       走框架统一登录与验签（不进白名单）；返回形状遵守 spec（如 runId / output / steps）。
 */
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BaseController } from '../common/base/base.controller';
import { LlmGateway } from './llm/llm.gateway';
import { LlmMessage } from './llm/llm.interface';
import { AgentScannerService } from './agent/agent-scanner.service';
import { SkillScannerService } from './skill/skill-scanner.service';
import { LangGraphOrchestratorService } from './lc-lg-runtime/langgraph/langgraph-orchestrator.service';
import { ToolRegistryService } from './tool/tool-registry.service';
import { RetrieverService } from './rag/retriever.service';
import { TraceService } from './trace/trace.service';

interface RagIngestBodyDto {
  path?: string;
}

interface AgentRunBodyDto {
  agent: string;
  input?: unknown;
  threadId?: string;
}

interface ChatBodyDto {
  /** 多轮对话 */
  messages?: LlmMessage[];
  /** 单轮简写，与 messages 二选一 */
  message?: string;
  model?: string;
}

const LLM_ROLES = new Set([
  'user',
  'assistant',
  'system',
  'function',
  'plugin',
  'tool',
]);

function normalizeChatMessages(body: ChatBodyDto): LlmMessage[] | null {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages.map((item) => {
      const role =
        typeof item.role === 'string' && LLM_ROLES.has(item.role)
          ? item.role
          : 'user';
      const content =
        typeof item.content === 'string'
          ? item.content
          : String(item.content ?? '');
      return { role, content };
    });
  }

  if (typeof body.message === 'string' && body.message.trim()) {
    return [{ role: 'user', content: body.message.trim() }];
  }

  return null;
}

@Controller('api/ai')
export class AiController extends BaseController {
  constructor(
    private readonly llmGateway: LlmGateway,
    private readonly skillScanner: SkillScannerService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly agentScanner: AgentScannerService,
    private readonly orchestrator: LangGraphOrchestratorService,
    private readonly traceService: TraceService,
    private readonly retrieverService: RetrieverService,
  ) {
    super();
  }

  @Post('rag/ingest')
  async ragIngest(@Body() body: RagIngestBodyDto) {
    const dir =
      typeof body?.path === 'string' && body.path.trim()
        ? body.path.trim()
        : this.retrieverService.resolveDefaultFixturesPath();
    try {
      const result = await this.retrieverService.ingestFromDirectory(dir);
      return this.success(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.fail(message, 50000);
    }
  }

  @Get('tool/list')
  toolList() {
    return this.success(this.toolRegistry.list());
  }

  @Get('agent/list')
  agentList() {
    return this.success(this.agentScanner.list());
  }

  @Get('agent/graph')
  agentGraph() {
    return this.success(this.orchestrator.graph());
  }

  @Post('skill/:name/invoke')
  async invokeSkill(@Param('name') name: string, @Body() input: unknown) {
    try {
      const data = await this.skillScanner.invoke(name, input ?? {});
      return this.success(data);
    } catch (err) {
      const code = (err as Error & { code?: number }).code;
      if (code === 40401) {
        return this.fail(
          err instanceof Error ? err.message : `skill "${name}" not found`,
          40401,
        );
      }
      throw err;
    }
  }

  @Post('agent/run')
  async agentRun(@Body() body: AgentRunBodyDto) {
    if (!body?.agent) {
      return this.fail('请提供 agent', 442);
    }
    try {
      const data = await this.orchestrator.run(
        body.agent,
        body.input ?? {},
        body.threadId,
      );
      return this.success(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        return this.fail(message, 40401);
      }
      throw err;
    }
  }

  @Post('agent/run/stream')
  async agentRunStream(@Body() body: AgentRunBodyDto, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!body?.agent) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: '请提供 agent' })}\n\n`,
      );
      res.end();
      return;
    }

    try {
      for await (const event of this.orchestrator.runStream(
        body.agent,
        body.input ?? {},
        body.threadId,
      )) {
        if (event.type === 'done') {
          res.write(
            `data: ${JSON.stringify({
              type: 'done',
              runId: event.runId,
              output: event.output,
              steps: event.steps,
              threadId: event.threadId,
            })}\n\n`,
          );
        } else {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get('trace/:runId')
  async getTrace(@Param('runId') runId: string) {
    const run = await this.traceService.load(runId);
    if (!run) {
      return this.fail(`trace "${runId}" not found`, 40401);
    }
    return this.success(run);
  }

  @Post('chat')
  async chat(@Body() body: ChatBodyDto) {
    const messages = normalizeChatMessages(body);
    if (!messages?.length) {
      return this.fail('请提供 message 或 messages', 442);
    }

    const output = await this.llmGateway.chat({
      messages,
      model: body.model,
      stream: false,
    });
    return this.success({ output });
  }

  @Post('chat/stream')
  async chatStream(@Body() body: ChatBodyDto, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = normalizeChatMessages(body);
    if (!messages?.length) {
      res.status(200);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: '请提供 message 或 messages' })}\n\n`,
      );
      res.end();
      return;
    }

    let output = '';
    try {
      for await (const delta of this.llmGateway.stream({
        messages,
        model: body.model,
        stream: true,
      })) {
        output += delta;
        res.write(`data: ${JSON.stringify({ type: 'token', delta })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', output })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}
