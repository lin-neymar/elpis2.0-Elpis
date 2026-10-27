/**
 * McpClient — MCP 协议客户端（stdio 换行 JSON-RPC / HTTP Streamable）
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as readline from 'readline';
import { McpServerConfig, McpToolDescriptor } from './mcp.types';

const MCP_PROTOCOL_VERSION = '2025-03-26';

export class McpClientError extends Error {
  constructor(
    message: string,
    public readonly serverName?: string,
  ) {
    super(message);
    this.name = 'McpClientError';
  }
}

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
};

export class McpClient {
  private readonly mode: 'stdio' | 'http';
  private proc?: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private nextId = 1;
  private sessionId?: string;
  private closed = false;

  constructor(
    private readonly server: McpServerConfig,
    private readonly demoRoot: string,
  ) {
    const hasCommand = !!server.command;
    const hasUrl = !!server.url;
    if (hasCommand && hasUrl) {
      throw new McpClientError(
        `server "${server.name}": command and url are mutually exclusive`,
        server.name,
      );
    }
    if (!hasCommand && !hasUrl) {
      throw new McpClientError(
        `server "${server.name}": command or url is required`,
        server.name,
      );
    }
    this.mode = hasCommand ? 'stdio' : 'http';
  }

  getServerName(): string {
    return this.server.name;
  }

  async connect(): Promise<void> {
    if (this.mode === 'stdio') {
      await this.connectStdio();
    } else {
      await this.connectHttp();
    }
    await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'elpis-mcp-client', version: '1.0.0' },
    });
    await this.notify('notifications/initialized', {});
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const result = (await this.request('tools/list', {})) as {
      tools?: McpToolDescriptor[];
    };
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    return this.request('tools/call', {
      name,
      arguments: args ?? {},
    });
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new McpClientError('MCP client closed', this.server.name),
      );
    }
    this.pending.clear();

    if (this.mode === 'stdio' && this.proc) {
      this.proc.kill();
      this.proc = undefined;
    }
    this.sessionId = undefined;
  }

  private async connectStdio(): Promise<void> {
    const cwd = this.server.cwd
      ? this.server.cwd.startsWith('/')
        ? this.server.cwd
        : `${this.demoRoot}/${this.server.cwd}`.replace(/\/+/g, '/')
      : this.demoRoot;

    this.proc = spawn(this.server.command!, this.server.args ?? [], {
      cwd,
      env: { ...process.env, ...this.server.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stderr.on('data', (chunk: Buffer) => {
      console.error(
        `[mcp][${this.server.name}][stderr]`,
        chunk.toString().trim(),
      );
    });

    this.proc.on('exit', (code) => {
      const err = new McpClientError(
        `MCP stdio process exited (${code ?? 'unknown'})`,
        this.server.name,
      );
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(err);
      }
      this.pending.clear();
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => this.handleIncomingLine(line));
  }

  private async connectHttp(): Promise<void> {
    // HTTP 模式无需预连接；initialize 在 connect() 中通过 POST 完成
  }

  private handleIncomingLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const message = JSON.parse(trimmed) as {
        id?: number;
        result?: unknown;
        error?: { message?: string; code?: number };
      };
      if (message.id === undefined) {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new McpClientError(
            message.error.message ?? 'MCP JSON-RPC error',
            this.server.name,
          ),
        );
        return;
      }
      pending.resolve(message.result);
    } catch (err) {
      console.error(`[mcp][${this.server.name}] invalid JSON line:`, trimmed);
    }
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };
    if (this.mode === 'stdio') {
      this.writeStdio(payload);
      return;
    }
    await this.httpExchange(payload, true);
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    if (this.mode === 'stdio') {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(
            new McpClientError(
              `MCP request timeout: ${method}`,
              this.server.name,
            ),
          );
        }, this.server.timeoutMs ?? 30_000);
        this.pending.set(id, { resolve, reject, timer });
        this.writeStdio(payload);
      });
    }

    return this.httpExchange(payload, false);
  }

  private writeStdio(payload: JsonRpcRequest): void {
    if (!this.proc?.stdin) {
      throw new McpClientError('stdio transport not ready', this.server.name);
    }
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private async httpExchange(
    payload: JsonRpcRequest,
    isNotification: boolean,
  ): Promise<unknown> {
    const url = this.server.url!;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(this.server.headers ?? {}),
    };
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.server.timeoutMs ?? 30_000,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const sessionHeader =
        response.headers.get('mcp-session-id') ??
        response.headers.get('Mcp-Session-Id');
      if (sessionHeader) {
        this.sessionId = sessionHeader;
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new McpClientError(
          `MCP HTTP ${response.status}: ${detail}`,
          this.server.name,
        );
      }

      if (isNotification) {
        return undefined;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const raw = await response.text();
      if (contentType.includes('text/event-stream')) {
        return this.parseSseJsonRpc(raw, payload.id);
      }

      const json = JSON.parse(raw) as {
        result?: unknown;
        error?: { message?: string };
      };
      if (json.error) {
        throw new McpClientError(
          json.error.message ?? 'MCP JSON-RPC error',
          this.server.name,
        );
      }
      return json.result;
    } catch (err) {
      if (err instanceof McpClientError) {
        throw err;
      }
      throw new McpClientError(
        err instanceof Error ? err.message : String(err),
        this.server.name,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parseSseJsonRpc(body: string, expectId?: number): unknown {
    const events = body.split('\n\n');
    for (const block of events) {
      const dataLine = block
        .split('\n')
        .find((line) => line.startsWith('data:'));
      if (!dataLine) {
        continue;
      }
      const data = dataLine.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      try {
        const message = JSON.parse(data) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (expectId !== undefined && message.id !== expectId) {
          continue;
        }
        if (message.error) {
          throw new McpClientError(
            message.error.message ?? 'MCP JSON-RPC error',
            this.server.name,
          );
        }
        return message.result;
      } catch (err) {
        if (err instanceof McpClientError) {
          throw err;
        }
      }
    }
    throw new McpClientError('MCP SSE response missing JSON-RPC result', this.server.name);
  }
}
