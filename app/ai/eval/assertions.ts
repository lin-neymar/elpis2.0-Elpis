/**
 * Eval 断言
 * 职责：纯函数判断一次 run 的行为轨迹。不断言 final 字符串全等。
 *       无 Nest 依赖，demo 的 node 跑批脚本可直接 require。
 */

export interface AssertionRunResult {
  output?: unknown;
  steps?: unknown;
}

export interface AssertionSpec {
  /** 任一名出现在 step.name / step.tool / step.skill / step JSON 中 */
  stepsContain?: string[];
  /** true 时要求 output 去空白后非空 */
  outputNotEmpty?: boolean;
  /** true 要求含 type=guardrail；false 要求不含 */
  guardrailBlocked?: boolean;
  /** output 命中任一子串 */
  outputContainsAny?: string[];
}

export interface AssertionReport {
  pass: boolean;
  reason?: string;
}

export function stepsContain(steps: unknown, names: string[]): boolean {
  if (!Array.isArray(steps) || !Array.isArray(names) || names.length === 0) {
    return false;
  }
  const needles = names.filter(
    (name) => typeof name === 'string' && name.length > 0,
  );
  if (needles.length === 0) {
    return false;
  }

  for (const step of steps) {
    if (step && typeof step === 'object') {
      const record = step as Record<string, unknown>;
      if (
        fieldHit(record.name, needles) ||
        fieldHit(record.tool, needles) ||
        fieldHit(record.skill, needles)
      ) {
        return true;
      }
    }
    const blob = JSON.stringify(step) ?? '';
    if (needles.some((name) => blob.includes(name))) {
      return true;
    }
  }
  return false;
}

export function outputNotEmpty(output: unknown): boolean {
  return typeof output === 'string' && output.trim().length > 0;
}

export function guardrailBlocked(steps: unknown): boolean {
  if (!Array.isArray(steps)) {
    return false;
  }
  return steps.some(
    (step) =>
      !!step &&
      typeof step === 'object' &&
      (step as { type?: unknown }).type === 'guardrail',
  );
}

export function outputContainsAny(output: unknown, needles: string[]): boolean {
  if (typeof output !== 'string' || !Array.isArray(needles)) {
    return false;
  }
  return needles.some(
    (needle) =>
      typeof needle === 'string' &&
      needle.length > 0 &&
      output.includes(needle),
  );
}

export function runAssertions(
  result: AssertionRunResult,
  assertSpec: AssertionSpec,
): AssertionReport {
  const spec = assertSpec ?? {};
  const steps = result?.steps;
  const output = result?.output;

  if (Array.isArray(spec.stepsContain)) {
    if (!stepsContain(steps, spec.stepsContain)) {
      return {
        pass: false,
        reason: `steps 未包含 ${spec.stepsContain.join(', ')}`,
      };
    }
  }

  if (spec.outputNotEmpty === true && !outputNotEmpty(output)) {
    return { pass: false, reason: 'output 为空' };
  }

  if (spec.guardrailBlocked === true && !guardrailBlocked(steps)) {
    return { pass: false, reason: 'steps 未包含 type=guardrail' };
  }

  if (spec.guardrailBlocked === false && guardrailBlocked(steps)) {
    return { pass: false, reason: 'steps 含 type=guardrail' };
  }

  if (Array.isArray(spec.outputContainsAny)) {
    if (!outputContainsAny(output, spec.outputContainsAny)) {
      return {
        pass: false,
        reason: `output 未包含 ${spec.outputContainsAny.join(', ')}`,
      };
    }
  }

  return { pass: true };
}

function fieldHit(value: unknown, names: string[]): boolean {
  if (typeof value === 'string') {
    return names.some((name) => value.includes(name));
  }
  if (value === undefined || value === null) {
    return false;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return names.some((name) => text.includes(name));
}
