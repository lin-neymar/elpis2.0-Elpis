import * as fs from 'fs';
import * as path from 'path';
import {
  VectorQueryHit,
  VectorRecord,
  VectorStore,
} from '../store.interface';

interface VectorFilePayload {
  records: VectorRecord[];
}

export class FileVectorStore implements VectorStore {
  private readonly filePath: string;

  constructor(rootDir: string) {
    this.filePath = path.join(rootDir, 'vectors.json');
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (!records.length) {
      return;
    }
    const existing = await this.loadAll();
    const map = new Map(existing.map((item) => [item.id, item]));
    for (const record of records) {
      map.set(record.id, record);
    }
    await this.saveAll([...map.values()]);
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryHit[]> {
    const records = await this.loadAll();
    const scored = records
      .map((record) => ({
        id: record.id,
        docId: record.docId,
        text: record.text,
        meta: record.meta,
        score: cosineSimilarity(embedding, record.embedding),
      }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(1, topK));
  }

  private async loadAll(): Promise<VectorRecord[]> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const payload = JSON.parse(raw) as VectorFilePayload;
      return Array.isArray(payload.records) ? payload.records : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  private async saveAll(records: VectorRecord[]): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: VectorFilePayload = { records };
    await fs.promises.writeFile(
      this.filePath,
      JSON.stringify(payload, null, 2),
      'utf8',
    );
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
