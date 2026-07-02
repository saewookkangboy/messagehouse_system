export const EMBEDDING_DIMENSIONS = 1024;

export const BGE_M3_KO_MODEL = "dragonkue/BGE-m3-ko";
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";

export interface EmbeddingProvider {
  readonly modelId: string;
  embed(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
