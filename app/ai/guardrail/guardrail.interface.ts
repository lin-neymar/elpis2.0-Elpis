/**
 * Guardrail 规则与检查结果
 * 职责：描述 demo 注入的拦截规则，以及一次输入检查的通过/拒绝结果。
 */
export interface GuardrailRuleSet {
  blockedKeywords?: string[];
  blockedPatterns?: string[];
}

export interface GuardrailCheckResult {
  safe: boolean;
  reason?: string;
}
