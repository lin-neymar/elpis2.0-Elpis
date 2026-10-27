import { ConfigService } from '../../../config/config.service';
import { McpConfig, McpServerConfig } from '../mcp.types';

export function loadMcpConfig(configService: ConfigService): McpConfig {
  const ai = configService.get('ai') as { mcp?: Partial<McpConfig> } | undefined;
  const raw = ai?.mcp;
  const enabled = raw?.enabled ?? false;
  const serversInput = Array.isArray(raw?.servers) ? raw.servers : [];

  const servers: McpServerConfig[] = [];
  for (const item of serversInput) {
    const normalized = normalizeServer(item);
    if (normalized) {
      servers.push(normalized);
    }
  }

  return { enabled, servers };
}

function normalizeServer(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const server = value as McpServerConfig;
  if (typeof server.name !== 'string' || !server.name.trim()) {
    throw new Error('[ai.mcp] each server requires a non-empty name');
  }

  const command =
    typeof server.command === 'string' && server.command.trim()
      ? server.command.trim()
      : undefined;
  const url =
    typeof server.url === 'string' && server.url.trim()
      ? server.url.trim()
      : undefined;

  if (!command && !url) {
    return null;
  }
  if (command && url) {
    throw new Error(
      `[ai.mcp] server "${server.name}": command and url are mutually exclusive`,
    );
  }

  return {
    name: server.name.trim(),
    timeoutMs: server.timeoutMs,
    command,
    args: Array.isArray(server.args) ? server.args : undefined,
    env:
      server.env && typeof server.env === 'object' ? server.env : undefined,
    cwd: typeof server.cwd === 'string' ? server.cwd : undefined,
    url,
    headers:
      server.headers && typeof server.headers === 'object'
        ? server.headers
        : undefined,
  };
}
