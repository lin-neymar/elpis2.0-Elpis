/**
 * EvalRunnerService — 离线评测执行器
 * 职责：读取评测用例，驱动 Orchestrator 或等价路径，汇总 pass/fail 报告；由 npm run eval 调用，无 /api/ai/eval。
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class EvalRunnerService {}
