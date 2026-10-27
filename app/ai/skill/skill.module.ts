/**
 * SkillModule — Skill 层 Nest 模块
 * 职责：提供并导出 SkillScannerService，供 Orchestrator 按名调用 Skill。
 */
import { Module } from '@nestjs/common';
import { SkillScannerService } from './skill-scanner.service';

@Module({
  providers: [SkillScannerService],
  exports: [SkillScannerService],
})
export class SkillModule {}
