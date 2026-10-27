/**
 * ToolRegistryService — Tool 注册表
 * 职责：维护 tool 名称 → ToolDefinition 映射；支持框架内置与 demo/MCP 注册，供 list API 与 Executor 解析。
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { builtinTools } from './builtin';
import { ToolDefinition, ToolListItem } from './tool.interface';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly registry = new Map<string, ToolDefinition>();

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    for (const factory of builtinTools) {
      this.register(factory({ moduleRef: this.moduleRef }));
    }
    const names = this.listNames();
    console.log('[tool] registered:', names.length ? names.join(', ') : '(none)');
  }

  register(tool: ToolDefinition): void {
    if (!tool?.name) {
      throw new Error('[tool] register requires tool.name');
    }
    if (this.registry.has(tool.name)) {
      throw new Error(`[tool] duplicate name "${tool.name}"`);
    }
    this.registry.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  listNames(): string[] {
    return [...this.registry.keys()].sort();
  }

  list(): ToolListItem[] {
    return this.listNames().map((name) => {
      const tool = this.registry.get(name)!;
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        source: tool.source,
      };
    });
  }
}
