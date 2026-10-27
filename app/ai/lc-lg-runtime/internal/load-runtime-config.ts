import { ConfigService } from '../../../config/config.service';

const DEFAULT_MAX_ITERATIONS = 5;

/**
 * 只解析循环上限。缺省、非数字或 <=0 时回到 5，避免没配就无限循环。
 */
export function resolveMaxIterations(configService: ConfigService): number {
  const ai = configService.get('ai') as
    | { runtime?: { maxIterations?: number } }
    | undefined;
  const raw = ai?.runtime?.maxIterations;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_ITERATIONS;
  }
  return Math.floor(raw);
}
