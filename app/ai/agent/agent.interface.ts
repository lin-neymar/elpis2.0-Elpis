/**
 * Agent 契约类型
 * 职责：AgentDefinition 为纯声明（skills、tools、prompt / promptFile、可选 model），不含执行逻辑。
 */
export interface AgentDefinition {
  name: string;
  skills: string[];
  tools: string[];
  prompt?: string;
  promptFile?: string;
  model?: string;
}

/** list API 返回：prompt 已解析为字符串 */
export interface AgentListItem {
  name: string;
  skills: string[];
  tools: string[];
  prompt: string;
  model?: string;
}
