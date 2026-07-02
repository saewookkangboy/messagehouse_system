import type { RetrievedChunk } from "@/lib/rag/schema";

export type PackChunkSearchInput = {
  contextPackId: string;
  queryVector: number[];
  sourceFileId?: string;
  topK: number;
};

export type OrgChunkSearchInput = {
  teamId: string;
  queryVector: number[];
  topK: number;
};

export interface VectorSearch {
  searchPackChunks(input: PackChunkSearchInput): Promise<RetrievedChunk[]>;
  searchOrgChunks(input: OrgChunkSearchInput): Promise<RetrievedChunk[]>;
}
