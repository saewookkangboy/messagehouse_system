import { EMBEDDING_DIMENSIONS, BGE_M3_KO_MODEL, type EmbeddingProvider } from "./schema";
import { l2Normalize } from "./cosine";

/**
 * Deterministic pseudo-embeddings from text hashes. Keeps RAG plumbing
 * testable with zero API keys, same pattern as StubAiProvider.
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = `${BGE_M3_KO_MODEL} (stub)`;

  private vectorFor(text: string): number[] {
    const raw = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (let i = 0; i < text.length; i++) {
      const bucket = i % EMBEDDING_DIMENSIONS;
      raw[bucket] = (raw[bucket] ?? 0) + text.charCodeAt(i) * (i + 1);
    }
    return l2Normalize(raw);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vectorFor(t));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.vectorFor(text);
  }
}
