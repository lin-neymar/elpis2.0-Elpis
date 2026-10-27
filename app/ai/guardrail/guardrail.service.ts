/**
 * GuardrailService — 安全与合规拦截
 * 职责：按 demo 配置的关键词与正则检查输入；不内置词表。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GuardrailCheckResult } from './guardrail.interface';
import { loadGuardrailConfig } from './internal/load-guardrail-config';

@Injectable()
export class GuardrailService {
  constructor(private readonly configService: ConfigService) {}

  check(input: string): GuardrailCheckResult {
    const text = typeof input === 'string' ? input : '';
    const rules = loadGuardrailConfig(this.configService);

    for (const keyword of rules.blockedKeywords ?? []) {
      if (text.includes(keyword)) {
        return { safe: false, reason: `命中禁用关键词：${keyword}` };
      }
    }

    for (const pattern of rules.blockedPatterns ?? []) {
      const matched = matchPattern(text, pattern);
      if (matched) {
        return { safe: false, reason: `命中禁用模式：${pattern}` };
      }
    }

    return { safe: true };
  }
}

function matchPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return text.includes(pattern);
  }
}
