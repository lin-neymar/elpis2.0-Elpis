/**
 * AiModule — Agent Runtime 根模块
 * 职责：装配 llm / store / skill / tool / mcp / agent / runtime / lc-lg-runtime / rag / memory / guardrail 等子模块；
 *       注册 embedding、trace、eval 等无独立 Module 的横切服务；
 *       挂载 AiController，对外导出 AI 能力供 demo 或其它模块复用。
 */
import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { AiController } from './ai.controller';
import { EmbeddingModule } from './embedding/embedding.module';
import { EvalRunnerService } from './eval/eval-runner.service';
import { GuardrailModule } from './guardrail/guardrail.module';
import { LcLgRuntimeModule } from './lc-lg-runtime/lc-lg-runtime.module';
import { LlmModule } from './llm/llm.module';
import { McpModule } from './mcp/mcp.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SkillModule } from './skill/skill.module';
import { StoreModule } from './store/store.module';
import { ToolModule } from './tool/tool.module';

@Module({
  imports: [
    LlmModule,
    EmbeddingModule,
    StoreModule,
    SkillModule,
    ToolModule,
    McpModule,
    AgentModule,
    RuntimeModule,
    LcLgRuntimeModule,
    RagModule,
    MemoryModule,
    GuardrailModule,
  ],
  controllers: [AiController],
  providers: [EvalRunnerService],
  exports: [
    LlmModule,
    StoreModule,
    SkillModule,
    ToolModule,
    McpModule,
    AgentModule,
    RuntimeModule,
    LcLgRuntimeModule,
    RagModule,
    MemoryModule,
    EmbeddingModule,
    GuardrailModule,
    EvalRunnerService,
  ],
})
export class AiModule {}
