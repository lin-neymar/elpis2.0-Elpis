/**
 * McpLoader — MCP Server 启动与连接
 * 职责：读取 demo 配置中的 MCP server 声明，拉起子进程或建立连接，并交给 McpRegistryService 登记。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { ToolDefinition } from '../tool/tool.interface';
import { loadMcpConfig } from './internal/load-mcp-config';
import { McpClient } from './mcp.client';
import { McpLoadedServer } from './mcp.types';

export interface McpLoadResult {
  tools: ToolDefinition[];
  servers: McpLoadedServer[];
}

@Injectable()
export class McpLoader {
  private clients: McpClient[] = [];

  constructor(private readonly configService: ConfigService) {}

  async load(): Promise<McpLoadResult> {
    this.closeAll();
    const config = loadMcpConfig(this.configService);
    if (!config.enabled || config.servers.length === 0) {
      return { tools: [], servers: [] };
    }

    const tools: ToolDefinition[] = [];
    const servers: McpLoadedServer[] = [];
    const demoRoot = process.cwd();

    for (const server of config.servers) {
      const client = new McpClient(server, demoRoot);
      try {
        await client.connect();
      } catch (err) {
        console.error(`[mcp] connect failed for "${server.name}":`, err);
        client.close();
        continue;
      }
      this.clients.push(client);

      let descriptors;
      try {
        descriptors = await client.listTools();
      } catch (err) {
        console.error(`[mcp] tools/list failed for "${server.name}":`, err);
        continue;
      }
      const toolNames: string[] = [];

      for (const desc of descriptors) {
        if (!desc?.name) {
          continue;
        }
        toolNames.push(desc.name);
        const toolName = desc.name;
        tools.push({
          name: toolName,
          description: desc.description ?? '',
          inputSchema: desc.inputSchema ?? {
            type: 'object',
            properties: {},
          },
          source: 'mcp',
          execute: (input: unknown) => client.callTool(toolName, input),
        });
      }

      servers.push({ serverName: server.name, toolNames });
    }

    return { tools, servers };
  }

  closeAll(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients = [];
  }
}
