import type { AppPrismaClient } from "@/lib/db/types";
import { db } from "@/lib/db";
import { cosineSimilarity } from "@/lib/embedding/cosine";
import { parseEmbeddingJson } from "@/lib/embedding/parseEmbedding";
import type { RetrievedChunk } from "@/lib/rag/schema";
import type { OrgChunkSearchInput, PackChunkSearchInput, VectorSearch } from "./types";

function rankChunks(
  rows: Array<{
    filename: string;
    chunkIndex: number;
    text: string;
    embedding: string;
    source: RetrievedChunk["source"];
  }>,
  queryVector: number[],
  topK: number,
): RetrievedChunk[] {
  const scored = rows.map((row) => ({
    filename: row.filename,
    chunkIndex: row.chunkIndex,
    text: row.text,
    score: cosineSimilarity(queryVector, parseEmbeddingJson(row.embedding)),
    source: row.source,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export class SqliteVectorSearch implements VectorSearch {
  constructor(private readonly client: AppPrismaClient = db) {}

  async searchPackChunks(input: PackChunkSearchInput): Promise<RetrievedChunk[]> {
    const rows = await this.client.documentChunk.findMany({
      where: input.sourceFileId
        ? { sourceFileId: input.sourceFileId }
        : { contextPackId: input.contextPackId },
      include: { sourceFile: { select: { filename: true } } },
    });

    return rankChunks(
      rows.map((row) => ({
        filename: row.sourceFile.filename,
        chunkIndex: row.chunkIndex,
        text: row.text,
        embedding: row.embedding,
        source: "pack" as const,
      })),
      input.queryVector,
      input.topK,
    );
  }

  async searchOrgChunks(input: OrgChunkSearchInput): Promise<RetrievedChunk[]> {
    const rows = await this.client.orgDocumentChunk.findMany({
      where: { orgDocument: { teamId: input.teamId } },
      include: { orgDocument: { select: { title: true, filename: true } } },
    });

    return rankChunks(
      rows.map((row) => ({
        filename: `${row.orgDocument.title} (${row.orgDocument.filename})`,
        chunkIndex: row.chunkIndex,
        text: row.text,
        embedding: row.embedding,
        source: "org_library" as const,
      })),
      input.queryVector,
      input.topK,
    );
  }
}
