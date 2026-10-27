import { EmbeddingProvider } from '../embedding.interface';

export interface OpenAiCompatibleEmbeddingConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

const MAX_RETRIES = 3;

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly cfg: OpenAiCompatibleEmbeddingConfig) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.embedOnce(texts);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 200));
        }
      }
    }
    throw lastError ?? new Error('embedding request failed');
  }

  private async embedOnce(texts: string[]): Promise<number[][]> {
    const url = `${this.cfg.baseURL.replace(/\/$/, '')}/embeddings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        input: texts,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`embeddings failed (${response.status}): ${detail}`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const rows = payload.data ?? [];
    return rows
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => row.embedding ?? []);
  }
}
