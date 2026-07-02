export function parseEmbeddingJson(raw: string): number[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "number")) {
    throw new Error("저장된 임베딩 형식이 올바르지 않아요.");
  }
  return parsed;
}

/** pgvector INSERT용 `[0.1,0.2,...]` 리터럴 */
export function embeddingToPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
