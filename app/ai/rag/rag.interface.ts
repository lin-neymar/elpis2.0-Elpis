export interface Chunk {
  id: string;
  docId: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface ChunkerLike {
  chunk(text: string, meta?: Record<string, unknown>): Chunk[];
}

export interface RagOptions {
  chunk?: {
    size: number;
    overlap: number;
  };
  topK?: number;
  tool?: {
    name?: string;
    description?: string;
  };
  chunker?: {
    use?: new () => ChunkerLike;
  };
  fixtures?: {
    path?: string;
  };
}
