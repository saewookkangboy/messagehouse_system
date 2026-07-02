import type { AppPrismaClient } from "@/lib/db/types";
import { db } from "@/lib/db";
import { embeddingToPgVectorLiteral } from "@/lib/embedding/parseEmbedding";
import { EMBEDDING_DIMENSIONS } from "@/lib/embedding/schema";
import type { RetrievedChunk } from "@/lib/rag/schema";
import type { OrgChunkSearchInput, PackChunkSearchInput, VectorSearch } from "./types";

type ScoredRow = {
  filename: string;
  chunk_index: number;
  text: string;
  score: number;
};

function toRetrievedChunk(row: ScoredRow, source: RetrievedChunk["source"]): RetrievedChunk {
  return {
    filename: row.filename,
    chunkIndex: row.chunk_index,
    text: row.text,
    score: Number(row.score),
    source,
  };
}

function assertVectorDimensions(vector: number[]): void {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `임베딩 차원이 ${EMBEDDING_DIMENSIONS}이 아니에요 (현재 ${vector.length}).`,
    );
  }
}

/**
 * PostgreSQL + pgvector 검색.
 * DocumentChunk / OrgDocumentChunk 의 embedding 컬럼은 vector(1024) 타입이어야 해요.
 */
export class PgVectorSearch implements VectorSearch {
  constructor(private readonly client: AppPrismaClient = db) {}

  async searchPackChunks(input: PackChunkSearchInput): Promise<RetrievedChunk[]> {
    assertVectorDimensions(input.queryVector);
    const literal = embeddingToPgVectorLiteral(input.queryVector);

    const rows = input.sourceFileId
      ? await this.client.$queryRawUnsafe<ScoredRow[]>(
          `SELECT sf."filename" AS filename,
                  dc."chunkIndex" AS chunk_index,
                  dc."text" AS text,
                  1 - (dc."embedding" <=> $1::vector) AS score
           FROM "DocumentChunk" dc
           INNER JOIN "SourceFile" sf ON sf."id" = dc."sourceFileId"
           WHERE dc."sourceFileId" = $2
           ORDER BY dc."embedding" <=> $1::vector
           LIMIT $3`,
          literal,
          input.sourceFileId,
          input.topK,
        )
      : await this.client.$queryRawUnsafe<ScoredRow[]>(
          `SELECT sf."filename" AS filename,
                  dc."chunkIndex" AS chunk_index,
                  dc."text" AS text,
                  1 - (dc."embedding" <=> $1::vector) AS score
           FROM "DocumentChunk" dc
           INNER JOIN "SourceFile" sf ON sf."id" = dc."sourceFileId"
           WHERE dc."contextPackId" = $2
           ORDER BY dc."embedding" <=> $1::vector
           LIMIT $3`,
          literal,
          input.contextPackId,
          input.topK,
        );

    return rows.map((row) => toRetrievedChunk(row, "pack"));
  }

  async searchOrgChunks(input: OrgChunkSearchInput): Promise<RetrievedChunk[]> {
    assertVectorDimensions(input.queryVector);
    const literal = embeddingToPgVectorLiteral(input.queryVector);

    const rows = await this.client.$queryRawUnsafe<ScoredRow[]>(
      `SELECT (od."title" || ' (' || od."filename" || ')') AS filename,
              odc."chunkIndex" AS chunk_index,
              odc."text" AS text,
              1 - (odc."embedding" <=> $1::vector) AS score
       FROM "OrgDocumentChunk" odc
       INNER JOIN "OrgDocument" od ON od."id" = odc."orgDocumentId"
       WHERE od."teamId" = $2
       ORDER BY odc."embedding" <=> $1::vector
       LIMIT $3`,
      literal,
      input.teamId,
      input.topK,
    );

    return rows.map((row) => toRetrievedChunk(row, "org_library"));
  }
}

/** PostgreSQL 청크 INSERT — vector(1024) 캐스팅 */
export async function insertDocumentChunkVector(
  input: {
    id: string;
    sourceFileId: string;
    contextPackId: string;
    chunkIndex: number;
    text: string;
    embedding: number[];
    model: string;
    createdAt: Date;
  },
  client: AppPrismaClient = db,
): Promise<void> {
  assertVectorDimensions(input.embedding);
  const literal = embeddingToPgVectorLiteral(input.embedding);
  await client.$executeRawUnsafe(
    `INSERT INTO "DocumentChunk" (
      "id", "sourceFileId", "contextPackId", "chunkIndex",
      "text", "embedding", "model", "createdAt"
    ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)`,
    input.id,
    input.sourceFileId,
    input.contextPackId,
    input.chunkIndex,
    input.text,
    literal,
    input.model,
    input.createdAt,
  );
}

export async function insertOrgDocumentChunkVector(
  input: {
    id: string;
    orgDocumentId: string;
    chunkIndex: number;
    text: string;
    embedding: number[];
    model: string;
    createdAt: Date;
  },
  client: AppPrismaClient = db,
): Promise<void> {
  assertVectorDimensions(input.embedding);
  const literal = embeddingToPgVectorLiteral(input.embedding);
  await client.$executeRawUnsafe(
    `INSERT INTO "OrgDocumentChunk" (
      "id", "orgDocumentId", "chunkIndex", "text", "embedding", "model", "createdAt"
    ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
    input.id,
    input.orgDocumentId,
    input.chunkIndex,
    input.text,
    literal,
    input.model,
    input.createdAt,
  );
}
