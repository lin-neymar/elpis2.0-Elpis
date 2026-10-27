/**
 * Tool 契约类型
 * 职责：ToolDefinition 描述 Agent 可调用的工具；BuiltinToolFactory 供框架内置工具从 Nest 容器取依赖。
 */
import { ModuleRef } from '@nestjs/core';

export interface ToolContext {
  runId?: string;
  threadId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown, ctx?: ToolContext): Promise<unknown>;
  source?: 'builtin' | 'mcp';
}

export type BuiltinToolFactory = (deps: {
  moduleRef: ModuleRef;
}) => ToolDefinition;

export interface ToolListItem {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source?: 'builtin' | 'mcp';
}
