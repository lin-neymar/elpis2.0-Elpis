import * as fs from 'fs';
import * as path from 'path';
import { TraceRun, TraceStore } from '../store.interface';

export class FileTraceStore implements TraceStore {
  constructor(private readonly rootDir: string) {}

  async save(run: TraceRun): Promise<void> {
    await fs.promises.mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, `${run.runId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(run, null, 2), 'utf8');
  }

  async load(runId: string): Promise<TraceRun | null> {
    const filePath = path.join(this.rootDir, `${runId}.json`);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(raw) as TraceRun;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }
}
