/**
 * McpRegistryService — MCP Tool 注册
 * 职责：将 MCP 暴露的 tool 适配为与内置 Skill 同形态的调用入口，写入 ToolRegistry。
 */
import { Injectable } from '@nestjs/common';
import { ToolDefinition } from '../tool/tool.interface';
import { ToolRegistryService } from '../tool/tool-registry.service';
import { McpLoadResult } from './mcp.loader';

@Injectable()
export class McpRegistryService {
  registerAll(toolRegistry: ToolRegistryService, loaded: McpLoadResult): void {
    for (const tool of loaded.tools) {
      if (tool.source !== 'mcp') {
        throw new Error(
          `[mcp] tool "${tool.name}" must have source "mcp" before register`,
        );
      }
      toolRegistry.register(tool);
    }

    for (const server of loaded.servers) {
      const names = server.toolNames.length
        ? server.toolNames.join(', ')
        : '(none)';
      console.log(`[mcp] server "${server.serverName}" tools: ${names}`);
    }
  }
}
