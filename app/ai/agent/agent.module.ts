/**
 * AgentModule — Agent 声明层 Nest 模块
 * 职责：提供并导出 AgentScannerService。
 */
import { Module } from '@nestjs/common';
import { AgentScannerService } from './agent-scanner.service';

@Module({
  providers: [AgentScannerService],
  exports: [AgentScannerService],
})
export class AgentModule {}
