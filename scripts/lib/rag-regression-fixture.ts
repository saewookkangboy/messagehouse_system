import type { AppPrismaClient } from "@/lib/db/types";
import { StubEmbeddingProvider } from "@/lib/embedding/stub";
import {
  insertDocumentChunkVector,
  insertOrgDocumentChunkVector,
} from "@/lib/embedding/vectorSearch/pg";

export const REGRESSION_IDS = {
  teamId: "reg-team-01",
  packId: "reg-pack-01",
  fileId: "reg-file-01",
  orgDocId: "reg-orgdoc-01",
} as const;

const CHUNK_TEXTS = [
  "한화생명 AI 언더라이팅은 보험 가입 심사 시간을 10분으로 단축합니다.",
  "금융위원회 가이드라인에 따른 개인정보 보호 절차를 준수합니다.",
  "스마트 언더라이팅과 고객 중심 보험 서비스를 강조합니다.",
  "2026년 디지털 보험 트렌드와 AIEO 키워드 최적화가 필요합니다.",
  "경쟁사 대비 실시간 리스크 모니터링이 차별화 포인트입니다.",
];

const ORG_CHUNK_TEXTS = [
  "조직 공통 브랜드 가이드: 공식 용어는 스마트 언더라이팅입니다.",
  "금지 표현 목록에 최저가, 무조건, 확실한 수익을 포함합니다.",
];

export const REGRESSION_QUERIES = [
  "AI 언더라이팅 보험 가입 시간 혁신",
  "개인정보 금융위원회 가이드라인",
  "조직 공통 브랜드 가이드 공식 용어",
  "경쟁사 리스크 모니터링 차별화",
];

const provider = new StubEmbeddingProvider();

export async function seedRegressionFixture(
  client: AppPrismaClient,
  options: { pgVector?: boolean } = {},
): Promise<void> {
  const now = new Date();

  await client.team.upsert({
    where: { id: REGRESSION_IDS.teamId },
    create: { id: REGRESSION_IDS.teamId, name: "Regression Team" },
    update: {},
  });

  await client.contextPack.upsert({
    where: { id: REGRESSION_IDS.packId },
    create: {
      id: REGRESSION_IDS.packId,
      issue: "RAG Regression Pack",
      industry: "보험",
      teamId: REGRESSION_IDS.teamId,
      status: "draft",
    },
    update: {},
  });

  await client.sourceFile.upsert({
    where: { id: REGRESSION_IDS.fileId },
    create: {
      id: REGRESSION_IDS.fileId,
      contextPackId: REGRESSION_IDS.packId,
      filename: "regression-demo.txt",
      mimeType: "text/plain",
      sizeBytes: 4096,
      extractedText: CHUNK_TEXTS.join("\n\n"),
    },
    update: {},
  });

  await client.documentChunk.deleteMany({ where: { sourceFileId: REGRESSION_IDS.fileId } });

  const packVectors = await provider.embed(CHUNK_TEXTS);
  for (let i = 0; i < CHUNK_TEXTS.length; i++) {
    const base = {
      id: `reg-chunk-${i}`,
      sourceFileId: REGRESSION_IDS.fileId,
      contextPackId: REGRESSION_IDS.packId,
      chunkIndex: i,
      text: CHUNK_TEXTS[i]!,
      model: provider.modelId,
      createdAt: now,
    };

    if (options.pgVector) {
      await insertDocumentChunkVector(
        { ...base, embedding: packVectors[i]! },
        client,
      );
    } else {
      await client.documentChunk.create({
        data: { ...base, embedding: JSON.stringify(packVectors[i]) },
      });
    }
  }

  await client.orgDocument.upsert({
    where: { id: REGRESSION_IDS.orgDocId },
    create: {
      id: REGRESSION_IDS.orgDocId,
      teamId: REGRESSION_IDS.teamId,
      title: "브랜드 가이드",
      filename: "brand-guide.txt",
      mimeType: "text/plain",
      sizeBytes: 2048,
      extractedText: ORG_CHUNK_TEXTS.join("\n\n"),
    },
    update: {},
  });

  await client.orgDocumentChunk.deleteMany({
    where: { orgDocumentId: REGRESSION_IDS.orgDocId },
  });

  const orgVectors = await provider.embed(ORG_CHUNK_TEXTS);
  for (let i = 0; i < ORG_CHUNK_TEXTS.length; i++) {
    const base = {
      id: `reg-org-chunk-${i}`,
      orgDocumentId: REGRESSION_IDS.orgDocId,
      chunkIndex: i,
      text: ORG_CHUNK_TEXTS[i]!,
      model: provider.modelId,
      createdAt: now,
    };

    if (options.pgVector) {
      await insertOrgDocumentChunkVector(
        { ...base, embedding: orgVectors[i]! },
        client,
      );
    } else {
      await client.orgDocumentChunk.create({
        data: { ...base, embedding: JSON.stringify(orgVectors[i]) },
      });
    }
  }
}

export async function embedRegressionQuery(query: string): Promise<number[]> {
  return provider.embedQuery(query);
}
