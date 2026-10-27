/**
 * McpModule — MCP 集成 Nest 模块
 * 职责：装配 McpLoader、McpRegistryService；启动时注册 MCP tools，销毁时关闭连接。
 */
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ToolModule } from '../tool/tool.module';
import { ToolRegistryService } from '../tool/tool-registry.service';
import { McpLoader } from './mcp.loader';
import { McpRegistryService } from './mcp-registry.service';

@Module({
  imports: [ToolModule],
  providers: [McpLoader, McpRegistryService],
  exports: [McpLoader, McpRegistryService],
})
export class McpModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly mcpLoader: McpLoader,
    private readonly mcpRegistry: McpRegistryService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async onModuleInit() {
    const loaded = await this.mcpLoader.load();
    if (loaded.tools.length > 0) {
      this.mcpRegistry.registerAll(this.toolRegistry, loaded);
    }
  }

  onModuleDestroy() {
    this.mcpLoader.closeAll();
  }
}
