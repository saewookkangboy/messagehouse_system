import { getVectorBackend } from "@/lib/db/config";
import { PgVectorSearch } from "./pg";
import { SqliteVectorSearch } from "./sqlite";
import type { VectorSearch } from "./types";

export type { OrgChunkSearchInput, PackChunkSearchInput, VectorSearch } from "./types";
export { PgVectorSearch, insertDocumentChunkVector, insertOrgDocumentChunkVector } from "./pg";
export { SqliteVectorSearch } from "./sqlite";

let cached: VectorSearch | undefined;

export function getVectorSearch(): VectorSearch {
  if (cached) return cached;
  cached = getVectorBackend() === "pgvector" ? new PgVectorSearch() : new SqliteVectorSearch();
  return cached;
}

/** 테스트용 — provider 캐시 초기화 */
export function _resetVectorSearchForTests(): void {
  cached = undefined;
}
