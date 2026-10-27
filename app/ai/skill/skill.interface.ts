/**
 * Skill 契约类型
 * 职责：SkillDefinition 描述可扫描注册的能力单元（名称、描述、入参 schema、execute）；
 *       SkillContext 携带 runId / threadId 等运行时上下文，业务逻辑在 demo 的 dist/skills 中实现。
 */
export interface SkillContext {
  runId?: string;
  threadId?: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown, ctx: SkillContext): Promise<unknown>;
}
