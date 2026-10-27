import { ConfigService } from '../../../config/config.service';
import { GuardrailRuleSet } from '../guardrail.interface';

/**
 * 从合并后的配置读取 ai.guardrail。
 * 规则由 demo 的 config 注入，框架不另读 guardrail.config.js / guardrail.rules.js。
 */
export function loadGuardrailConfig(
  configService: ConfigService,
): GuardrailRuleSet {
  const ai = configService.get('ai') as { guardrail?: unknown } | undefined;
  const guardrail = ai?.guardrail;
  if (!guardrail || typeof guardrail !== 'object') {
    return {};
  }

  const record = guardrail as {
    rules?: unknown;
    blockedKeywords?: unknown;
    blockedPatterns?: unknown;
  };
  const source =
    record.rules && typeof record.rules === 'object'
      ? (record.rules as {
          blockedKeywords?: unknown;
          blockedPatterns?: unknown;
        })
      : record;

  return {
    blockedKeywords: normalizeStringList(source.blockedKeywords),
    blockedPatterns: normalizeStringList(source.blockedPatterns),
  };
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return items.length > 0 ? items : undefined;
}
