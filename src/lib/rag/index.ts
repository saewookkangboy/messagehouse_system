import { db } from "@/lib/db";
import { isPgVectorEnabled } from "@/lib/db/config";
import { getEmbeddingProvider } from "@/lib/embedding";
import {
  getVectorSearch,
  insertDocumentChunkVector,
  insertOrgDocumentChunkVector,
} from "@/lib/embedding/vectorSearch";
import { isAuthEnabled } from "@/lib/auth/types";
import { getDemoTeamId } from "@/lib/auth/session";
import { chunkText } from "./chunking";
import { DEFAULT_TOP_K, type RetrievedChunk } from "./schema";

const RAG_CHAR_BUDGET = 12_000;
const RAG_MIN_TEXT_LENGTH = 4_000;
const ANALYZE_QUERY =
  "이 문서의 핵심 주제, 핵심 주장, 수치와 데이터, 공식 용어, 대상 독자, 리스크 문장";

function newChunkId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

/** (Re)indexes all chunks for a source file. Safe to call on re-upload. */
export async function indexSourceFile(sourceFileId: string): Promise<number> {
  const file = await db.sourceFile.findUnique({ where: { id: sourceFileId } });
  if (!file) {
    throw new Error("인덱싱할 파일을 찾지 못했어요.");
  }

  const provider = getEmbeddingProvider();
  const pieces = chunkText(file.extractedText);
  await db.documentChunk.deleteMany({ where: { sourceFileId } });

  if (pieces.length === 0) return 0;

  const vectors = await provider.embed(pieces);
  const createdAt = new Date();

  if (isPgVectorEnabled()) {
    for (let chunkIndex = 0; chunkIndex < pieces.length; chunkIndex++) {
      await insertDocumentChunkVector({
        id: newChunkId(),
        sourceFileId,
        contextPackId: file.contextPackId,
        chunkIndex,
        text: pieces[chunkIndex]!,
        embedding: vectors[chunkIndex]!,
        model: provider.modelId,
        createdAt,
      });
    }
  } else {
    await db.documentChunk.createMany({
      data: pieces.map((text, chunkIndex) => ({
        sourceFileId,
        contextPackId: file.contextPackId,
        chunkIndex,
        text,
        embedding: JSON.stringify(vectors[chunkIndex]),
        model: provider.modelId,
      })),
    });
  }

  return pieces.length;
}

/** Indexes every file in a context pack (e.g. after batch upload). */
export async function indexContextPack(contextPackId: string): Promise<number> {
  const files = await db.sourceFile.findMany({
    where: { contextPackId },
    select: { id: true },
  });
  let total = 0;
  for (const file of files) {
    total += await indexSourceFile(file.id);
  }
  return total;
}

/** Indexes an organization library document. */
export async function indexOrgDocument(orgDocumentId: string): Promise<number> {
  const doc = await db.orgDocument.findUnique({ where: { id: orgDocumentId } });
  if (!doc) {
    throw new Error("인덱싱할 조직 문서를 찾지 못했어요.");
  }

  const provider = getEmbeddingProvider();
  const pieces = chunkText(doc.extractedText);
  await db.orgDocumentChunk.deleteMany({ where: { orgDocumentId } });

  if (pieces.length === 0) return 0;

  const vectors = await provider.embed(pieces);
  const createdAt = new Date();

  if (isPgVectorEnabled()) {
    for (let chunkIndex = 0; chunkIndex < pieces.length; chunkIndex++) {
      await insertOrgDocumentChunkVector({
        id: newChunkId(),
        orgDocumentId,
        chunkIndex,
        text: pieces[chunkIndex]!,
        embedding: vectors[chunkIndex]!,
        model: provider.modelId,
        createdAt,
      });
    }
  } else {
    await db.orgDocumentChunk.createMany({
      data: pieces.map((text, chunkIndex) => ({
        orgDocumentId,
        chunkIndex,
        text,
        embedding: JSON.stringify(vectors[chunkIndex]),
        model: provider.modelId,
      })),
    });
  }

  return pieces.length;
}

export async function retrieveRelevantChunks(input: {
  contextPackId: string;
  query: string;
  topK?: number;
  sourceFileId?: string;
  teamId?: string | null;
}): Promise<RetrievedChunk[]> {
  const topK = input.topK ?? DEFAULT_TOP_K;
  const provider = getEmbeddingProvider();
  const queryVector = await provider.embedQuery(input.query);
  const search = getVectorSearch();

  const packChunks = await search.searchPackChunks({
    contextPackId: input.contextPackId,
    queryVector,
    sourceFileId: input.sourceFileId,
    topK,
  });

  let teamId = input.teamId;
  if (!teamId && !isAuthEnabled()) {
    teamId = await getDemoTeamId();
  }

  const orgChunks: RetrievedChunk[] =
    teamId && !input.sourceFileId
      ? await search.searchOrgChunks({ teamId, queryVector, topK })
      : [];

  const merged = [...packChunks, ...orgChunks];
  if (merged.length === 0) return [];

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}

/**
 * 긴 문서는 BGE-m3-ko 임베딩으로 관련 청크만 골라 분석 프롬프트에 넣어요.
 * 4,000자 이하 문서는 전체 텍스트를 그대로 씁니다.
 */
export async function buildRagContextForAnalysis(input: {
  sourceFileId: string;
  text: string;
  teamId?: string | null;
}): Promise<{ text: string; usedRag: boolean; chunkCount: number }> {
  if (input.text.length <= RAG_MIN_TEXT_LENGTH) {
    return { text: input.text, usedRag: false, chunkCount: 0 };
  }

  const existing = await db.documentChunk.count({
    where: { sourceFileId: input.sourceFileId },
  });
  if (existing === 0) {
    await indexSourceFile(input.sourceFileId);
  }

  const file = await db.sourceFile.findUnique({
    where: { id: input.sourceFileId },
    select: { contextPackId: true },
  });
  if (!file) {
    return { text: input.text.slice(0, RAG_CHAR_BUDGET), usedRag: false, chunkCount: 0 };
  }

  const ranked = await retrieveRelevantChunks({
    contextPackId: file.contextPackId,
    sourceFileId: input.sourceFileId,
    teamId: input.teamId,
    query: ANALYZE_QUERY,
    topK: 8,
  });

  const selected: string[] = [];
  let usedChars = 0;
  for (const chunk of ranked) {
    const nextLength = chunk.text.length + (selected.length > 0 ? 2 : 0);
    if (usedChars + nextLength > RAG_CHAR_BUDGET) break;
    selected.push(chunk.text);
    usedChars += nextLength;
  }

  if (selected.length === 0) {
    return { text: input.text.slice(0, RAG_CHAR_BUDGET), usedRag: false, chunkCount: 0 };
  }

  return {
    text: selected.join("\n\n"),
    usedRag: true,
    chunkCount: selected.length,
  };
}
