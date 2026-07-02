import type { EmbeddingProvider } from "./schema";
import { StubEmbeddingProvider } from "./stub";
import { BgeM3KoEmbeddingProvider } from "./bgeM3Ko";
import { OpenAiEmbeddingProvider } from "./openai";

export * from "./schema";
export { cosineSimilarity } from "./cosine";

let cached: EmbeddingProvider | undefined;

/**
 * Selection order:
 * - EMBEDDING_PROVIDER=stub      -> deterministic demo vectors
 * - EMBEDDING_PROVIDER=bge-m3-ko -> dragonkue/BGE-m3-ko via HF (throws if no HF_TOKEN)
 * - EMBEDDING_PROVIDER=openai    -> text-embedding-3-large (throws if no OPENAI_API_KEY)
 * - unset                        -> HF_TOKEN if present (Korean-optimized default),
 *                                   else OPENAI_API_KEY, else stub
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;

  const mode = process.env.EMBEDDING_PROVIDER;
  if (mode === "stub") {
    cached = new StubEmbeddingProvider();
  } else if (mode === "bge-m3-ko") {
    cached = new BgeM3KoEmbeddingProvider();
  } else if (mode === "openai") {
    cached = new OpenAiEmbeddingProvider();
  } else if (process.env.HF_TOKEN) {
    cached = new BgeM3KoEmbeddingProvider();
  } else if (process.env.OPENAI_API_KEY) {
    cached = new OpenAiEmbeddingProvider();
  } else {
    cached = new StubEmbeddingProvider();
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized provider between runs. */
export function _resetEmbeddingProviderForTests(): void {
  cached = undefined;
}
