/**
 * AgentScannerService — Agent 发现与注册
 * 职责：扫描 demo 提供的 Agent 声明文件，构建 agent/list 注册表；Orchestrator 按 agent 名读取策略与人设。
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import glob = require('glob');
import { AgentDefinition, AgentListItem } from './agent.interface';

const runtimeRequire = createRequire(__filename);

@Injectable()
export class AgentScannerService implements OnModuleInit {
  private readonly registry = new Map<string, AgentDefinition>();

  onModuleInit() {
    this.scan();
    const names = this.listNames();
    console.log('[agent] registered:', names.length ? names.join(', ') : '(none)');
  }

  listNames(): string[] {
    return [...this.registry.keys()].sort();
  }

  get(name: string): AgentDefinition | undefined {
    return this.registry.get(name);
  }

  list(): AgentListItem[] {
    return this.listNames().map((name) => this.toListItem(this.registry.get(name)!));
  }

  private toListItem(agent: AgentDefinition): AgentListItem {
    return {
      name: agent.name,
      skills: agent.skills,
      tools: agent.tools,
      prompt: agent.prompt ?? '',
      model: agent.model,
    };
  }

  private scan() {
    this.registry.clear();
    const agentsDir = path.resolve(process.cwd(), 'dist/agents');
    if (!fs.existsSync(agentsDir)) {
      return;
    }

    const files = glob.sync('**/*.agent.js', { cwd: agentsDir }).sort();
    for (const relativePath of files) {
      const fullPath = path.join(agentsDir, relativePath);
      let loaded: unknown;
      try {
        const mod = runtimeRequire(fullPath) as { default?: AgentDefinition };
        loaded = mod.default ?? mod;
      } catch (err) {
        console.error(`[agent] failed to load ${relativePath}:`, err);
        continue;
      }

      try {
        const agent = this.assertAgentDefinition(loaded, relativePath);
        const resolved: AgentDefinition = {
          ...agent,
          prompt: this.loadPrompt(agent, fullPath),
        };
        delete resolved.promptFile;

        if (this.registry.has(resolved.name)) {
          throw new Error(
            `duplicate agent name "${resolved.name}" (${relativePath})`,
          );
        }
        this.registry.set(resolved.name, resolved);
      } catch (err) {
        console.error(`[agent] invalid ${relativePath}:`, err);
      }
    }
  }

  private loadPrompt(agent: AgentDefinition, agentFilePath: string): string {
    if (typeof agent.prompt === 'string' && agent.prompt.length > 0) {
      return agent.prompt;
    }
    if (!agent.promptFile) {
      throw new Error('either prompt or promptFile is required');
    }

    const promptPath = path.resolve(path.dirname(agentFilePath), agent.promptFile);
    if (!fs.existsSync(promptPath)) {
      throw new Error(`promptFile not found: ${agent.promptFile}`);
    }

    const mod = runtimeRequire(promptPath) as { default?: unknown };
    const content = mod.default ?? mod;
    if (typeof content !== 'string') {
      throw new Error(`promptFile must default-export a string (${agent.promptFile})`);
    }
    return content;
  }

  private assertAgentDefinition(
    value: unknown,
    source: string,
  ): AgentDefinition {
    if (!value || typeof value !== 'object') {
      throw new Error(`${source}: export must be an AgentDefinition object`);
    }
    const agent = value as AgentDefinition;
    if (typeof agent.name !== 'string' || !agent.name.trim()) {
      throw new Error(`${source}: name must be a non-empty string`);
    }
    if (!Array.isArray(agent.skills)) {
      throw new Error(`${source}: skills must be an array`);
    }
    if (!Array.isArray(agent.tools)) {
      throw new Error(`${source}: tools must be an array`);
    }
    const hasPrompt =
      typeof agent.prompt === 'string' && agent.prompt.length > 0;
    const hasPromptFile =
      typeof agent.promptFile === 'string' && agent.promptFile.length > 0;
    if (!hasPrompt && !hasPromptFile) {
      throw new Error(`${source}: prompt or promptFile is required`);
    }
    return agent;
  }
}
