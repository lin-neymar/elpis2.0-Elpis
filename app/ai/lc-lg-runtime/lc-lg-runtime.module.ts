/**
 * LcLgRuntimeModule — LangChain / LangGraph 生产运行时
 * 职责：注册 Planner 与 LangGraph Orchestrator。ExecutorService 只在本模块一份，不导出。
 */
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { GuardrailModule } from '../guardrail/guardrail.module';
import { MemoryModule } from '../memory/memory.module';
import { ExecutorService } from '../runtime/executor.service';
import { RuntimeModule } from '../runtime/runtime.module';
import { SkillModule } from '../skill/skill.module';
import { ToolModule } from '../tool/tool.module';
import { LangChainPlannerService } from './langchain/langchain-planner.service';
import { LangGraphOrchestratorService } from './langgraph/langgraph-orchestrator.service';

@Module({
  imports: [
    AgentModule,
    SkillModule,
    ToolModule,
    MemoryModule,
    GuardrailModule,
    RuntimeModule,
  ],
  providers: [
    LangChainPlannerService,
    LangGraphOrchestratorService,
    ExecutorService,
  ],
  exports: [LangGraphOrchestratorService],
})
export class LcLgRuntimeModule {}
