/**
 * RuntimeModule — 运行时编排 Nest 模块
 * 职责：提供 Planner、Executor、Orchestrator，并导出供 AiController 与 eval 脚本使用。
 */
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { GuardrailModule } from '../guardrail/guardrail.module';
import { LlmModule } from '../llm/llm.module';
import { SkillModule } from '../skill/skill.module';
import { MemoryModule } from '../memory/memory.module';
import { StoreModule } from '../store/store.module';
import { ToolModule } from '../tool/tool.module';
import { TraceService } from '../trace/trace.service';
import { ExecutorService } from './executor.service';
import { OrchestratorService } from './orchestrator.service';
import { PlannerService } from './planner.service';

@Module({
  imports: [
    LlmModule,
    AgentModule,
    SkillModule,
    ToolModule,
    StoreModule,
    MemoryModule,
    GuardrailModule,
  ],
  providers: [
    PlannerService,
    ExecutorService,
    OrchestratorService,
    TraceService,
  ],
  exports: [OrchestratorService, TraceService],
})
export class RuntimeModule {}
