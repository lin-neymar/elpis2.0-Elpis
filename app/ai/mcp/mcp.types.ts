export interface McpServerConfig {
  name: string;
  timeoutMs?: number;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpConfig {
  enabled?: boolean;
  servers: McpServerConfig[];
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpLoadedServer {
  serverName: string;
  toolNames: string[];
}
