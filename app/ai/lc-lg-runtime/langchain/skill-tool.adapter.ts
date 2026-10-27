/**
 * Skill / Tool（含 MCP）→ StructuredTool
 * 职责：把扫描器里的声明转成 LangChain 工具；execute 转调 SkillScanner / ToolRegistry。
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { SkillScannerService } from '../../skill/skill-scanner.service';
import { ToolRegistryService } from '../../tool/tool-registry.service';

export interface StructuredToolSource {
  skillScanner: SkillScannerService;
  toolRegistry: ToolRegistryService;
  skills: string[];
  tools: string[];
  runId: string;
}

export function toStructuredTools(
  source: StructuredToolSource,
): DynamicStructuredTool[] {
  const allowed = new Set([...source.skills, ...source.tools]);
  const seen = new Set<string>();
  const tools: DynamicStructuredTool[] = [];

  for (const item of source.skillScanner.toToolsPayload()) {
    const name = item.function.name;
    if (!allowed.has(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    tools.push(
      createDelegatingTool(
        name,
        item.function.description,
        item.function.parameters,
        async (input) =>
          source.skillScanner.invoke(name, input, { runId: source.runId }),
      ),
    );
  }

  for (const item of source.toolRegistry.list()) {
    if (!allowed.has(item.name) || seen.has(item.name)) {
      continue;
    }
    seen.add(item.name);
    const name = item.name;
    tools.push(
      createDelegatingTool(name, item.description, item.inputSchema, async (input) => {
        const tool = source.toolRegistry.get(name);
        if (!tool) {
          throw new Error(`unknown skill or tool "${name}"`);
        }
        return tool.execute(input, { runId: source.runId });
      }),
    );
  }

  return tools;
}

function createDelegatingTool(
  name: string,
  description: string,
  parameters: Record<string, unknown> | undefined,
  execute: (input: unknown) => Promise<unknown>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name,
    description: description || name,
    schema: toObjectSchema(parameters),
    func: async (input) => {
      try {
        return stringify(await execute(input));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: message });
      }
    },
  });
}

function toObjectSchema(schema: Record<string, unknown> | undefined): {
  type: 'object';
  properties: Record<string, never>;
  required?: string[];
  additionalProperties: boolean;
} {
  const properties =
    schema?.properties &&
    typeof schema.properties === 'object' &&
    !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, never>)
      : {};
  const required = Array.isArray(schema?.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : undefined;
  const additionalProperties =
    typeof schema?.additionalProperties === 'boolean'
      ? schema.additionalProperties
      : true;
  return {
    type: 'object',
    properties,
    ...(required ? { required } : {}),
    additionalProperties,
  };
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}
