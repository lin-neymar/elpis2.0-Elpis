/**
 * SkillScannerService — Skill 发现与注册
 * 职责：启动时扫描 demo 编译产物（如 dist/skills/*.js），加载 SkillDefinition 并维护名称 → 实例映射。
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import glob = require('glob');
import { SkillContext, SkillDefinition } from './skill.interface';

const runtimeRequire = createRequire(__filename);

export interface OpenAiToolDeclaration {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

@Injectable()
export class SkillScannerService implements OnModuleInit {
  private readonly registry = new Map<string, SkillDefinition>();

  onModuleInit() {
    this.scan();
    const names = this.listNames();
    console.log('[skill] registered:', names.length ? names.join(', ') : '(none)');
    console.log(
      '[skill] tools payload (for LLM):',
      JSON.stringify(this.toToolsPayload(), null, 2),
    );
  }

  listNames(): string[] {
    return [...this.registry.keys()].sort();
  }

  get(name: string): SkillDefinition | undefined {
    return this.registry.get(name);
  }

  toToolsPayload(): OpenAiToolDeclaration[] {
    return this.listNames().map((name) => {
      const skill = this.registry.get(name)!;
      return {
        type: 'function',
        function: {
          name: skill.name,
          description: skill.description,
          parameters: skill.inputSchema,
        },
      };
    });
  }

  async invoke(
    name: string,
    input: unknown,
    ctx: SkillContext = {},
  ): Promise<unknown> {
    const skill = this.registry.get(name);
    if (!skill) {
      const err = new Error(`skill "${name}" not found`);
      (err as Error & { code: number }).code = 40401;
      throw err;
    }
    return skill.execute(input, ctx);
  }

  private scan() {
    this.registry.clear();
    const skillsDir = path.resolve(process.cwd(), 'dist/skills');
    if (!fs.existsSync(skillsDir)) {
      return;
    }

    const files = glob.sync('**/*.skill.js', { cwd: skillsDir }).sort();
    for (const relativePath of files) {
      const fullPath = path.join(skillsDir, relativePath);
      let loaded: unknown;
      try {
        const mod = runtimeRequire(fullPath) as {
          default?: SkillDefinition;
        };
        loaded = mod.default ?? mod;
      } catch (err) {
        console.error(`[skill] failed to load ${relativePath}:`, err);
        continue;
      }

      try {
        const skill = this.assertSkillDefinition(loaded, relativePath);
        if (this.registry.has(skill.name)) {
          throw new Error(
            `duplicate skill name "${skill.name}" (${relativePath})`,
          );
        }
        this.registry.set(skill.name, skill);
      } catch (err) {
        console.error(`[skill] invalid ${relativePath}:`, err);
      }
    }
  }

  private assertSkillDefinition(
    value: unknown,
    source: string,
  ): SkillDefinition {
    if (!value || typeof value !== 'object') {
      throw new Error(`${source}: export must be a SkillDefinition object`);
    }
    const skill = value as SkillDefinition;
    if (typeof skill.name !== 'string' || !skill.name.trim()) {
      throw new Error(`${source}: name must be a non-empty string`);
    }
    if (typeof skill.description !== 'string') {
      throw new Error(`${source}: description must be a string`);
    }
    if (
      !skill.inputSchema ||
      typeof skill.inputSchema !== 'object' ||
      Array.isArray(skill.inputSchema)
    ) {
      throw new Error(`${source}: inputSchema must be a plain object`);
    }
    if (typeof skill.execute !== 'function') {
      throw new Error(`${source}: execute must be a function`);
    }
    return skill;
  }
}
