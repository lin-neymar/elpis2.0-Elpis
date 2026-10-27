import * as fs from 'fs';
import * as path from 'path';
import { MemoryStore, ThreadCheckpoint } from '../store.interface';

export class FileMemoryStore implements MemoryStore {
  constructor(private readonly rootDir: string) {}

  async save(checkpoint: ThreadCheckpoint): Promise<void> {
    await fs.promises.mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, `${checkpoint.threadId}.json`);
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(checkpoint, null, 2),
      'utf8',
    );
  }

  async load(threadId: string): Promise<ThreadCheckpoint | null> {
    const filePath = path.join(this.rootDir, `${threadId}.json`);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(raw) as ThreadCheckpoint;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(threadId: string): Promise<void> {
    const filePath = path.join(this.rootDir, `${threadId}.json`);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw err;
    }
  }
}
