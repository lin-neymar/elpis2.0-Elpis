/**
 * Store 持久化契约
 * 职责：TraceStore 存 run 回放；MemoryStore 存 thread/checkpoint；VectorStore 存 RAG 向量片段。
 *       框架无状态，具体实现与存储路径由 demo 注入。
 */
export interface TraceRun {
  runId: string;
  agentName: string;
  input: unknown;
  output?: string;
  steps: unknown[];
  messages: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface TraceStore {
  save(run: TraceRun): Promise<void>;
  load(runId: string): Promise<TraceRun | null>;
}

export interface MemoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 与 ThreadCheckpoint 同构，单条对话 turn 容器 */
export type MemoryEntry = MemoryMessage;

export interface ThreadCheckpoint {
  threadId: string;
  messages: MemoryMessage[];
  updatedAt: number;
}

export interface MemoryStore {
  save(checkpoint: ThreadCheckpoint): Promise<void>;
  load(threadId: string): Promise<ThreadCheckpoint | null>;
  delete?(threadId: string): Promise<void>;
}

export interface VectorRecord {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
  meta?: Record<string, unknown>;
}

export interface VectorQueryHit {
  id: string;
  docId: string;
  text: string;
  score: number;
  meta?: Record<string, unknown>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorQueryHit[]>;
}

export const TRACE_STORE = Symbol('TRACE_STORE');
export const VECTOR_STORE = Symbol('VECTOR_STORE');
export const MEMORY_STORE = Symbol('MEMORY_STORE');
