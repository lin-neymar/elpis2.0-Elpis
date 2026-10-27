import * as path from 'path';
import { ConfigService } from '../../../config/config.service';

export function resolveTraceStorePath(configService: ConfigService): string {
  const ai = configService.get('ai') as
    | { store?: { trace?: string } }
    | undefined;
  const configured = ai?.store?.trace;
  if (typeof configured === 'string' && configured.trim()) {
    return path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), '.elpis/trace');
}

export function resolveVectorStorePath(configService: ConfigService): string {
  const ai = configService.get('ai') as
    | { store?: { vector?: string | { path?: string } } }
    | undefined;
  const vector = ai?.store?.vector;
  if (typeof vector === 'string' && vector.trim()) {
    return path.resolve(process.cwd(), vector);
  }
  if (vector && typeof vector === 'object' && typeof vector.path === 'string') {
    const configured = vector.path.trim();
    if (configured) {
      return path.resolve(process.cwd(), configured);
    }
  }
  return path.resolve(process.cwd(), '.elpis/vector');
}

export function resolveMemoryStorePath(configService: ConfigService): string {
  const ai = configService.get('ai') as
    | { store?: { memory?: { path?: string } } }
    | undefined;
  const configured = ai?.store?.memory?.path;
  if (typeof configured === 'string' && configured.trim()) {
    return path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), '.elpis/memory');
}
