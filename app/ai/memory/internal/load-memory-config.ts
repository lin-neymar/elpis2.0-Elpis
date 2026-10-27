import { ConfigService } from '../../../config/config.service';
import { resolveMemoryStorePath } from '../../store/internal/load-store-config';

const DEFAULT_MAX_TURNS = 20;

export function resolveMemoryPath(configService: ConfigService): string {
  return resolveMemoryStorePath(configService);
}

export function resolveMemoryMaxTurns(configService: ConfigService): number {
  const ai = configService.get('ai') as
    | { store?: { memory?: { maxTurns?: number } } }
    | undefined;
  const raw = ai?.store?.memory?.maxTurns;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_TURNS;
  }
  return Math.floor(raw);
}
