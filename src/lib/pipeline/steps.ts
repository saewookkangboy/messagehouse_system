import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getAiProvider, AiResponseParseError } from "@/lib/ai";
import { getResearchProvider } from "@/lib/research";
import {
  deserializeResearchResult,
  serializePillars,
  serializeResearchResult,
  serializeStringList,
} from "@/lib/contextPackSerialization";
import { buildRagContextForAnalysis, retrieveRelevantChunks } from "@/lib/rag";
import { decryptField } from "@/lib/fieldCrypto";
import type {
  AnalyzeStepResult,
  GenerateStepResult,
  PackWithFiles,
  ResearchStepResult,
} from "./schema";
import { PipelineError } from "./schema";

function isRecordNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

async function loadPack(packId: string): Promise<PackWithFiles> {
  const pack = await db.contextPack.findUnique({
    where: { id: packId },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  if (!pack) {
    throw new PipelineError("Context Pack을 찾지 못했어요.", "upload", 404);
  }
  return pack;
}

export async function runAnalyzeStep(packId: string): Promise<AnalyzeStepResult> {
  const pack = await loadPack(packId);
  if (pack.files.length === 0) {
    throw new PipelineError("먼저 파일을 업로드해주세요.", "analyze");
  }

  const provider = getAiProvider();
  const pending = pack.files.filter((f) => !f.analyzedAt);
  const updated = [];
  const errors: AnalyzeStepResult["errors"] = [];

  for (const file of pending) {
    try {
      const rag = await buildRagContextForAnalysis({
        sourceFileId: file.id,
        text: decryptField(file.extractedText),
        teamId: pack.teamId,
      });
      const analysis = await provider.analyzeDocument({
        filename: file.filename,
        text: rag.usedRag
          ? `[RAG로 추출한 관련 구절 ${rag.chunkCount}개]\n\n${rag.text}`
          : rag.text,
      });
      const record = await db.sourceFile.update({
        where: { id: file.id },
        data: {
          docType: analysis.docType,
          topic: analysis.topic,
          claim: analysis.claim,
          numbers: analysis.numbers,
          terms: analysis.terms,
          audience: analysis.audience,
          risk: analysis.risk,
          analyzedAt: new Date(),
        },
      });
      updated.push(record);
    } catch (err) {
      errors.push({
        filename: file.filename,
        message: err instanceof Error ? err.message : "분석 중 오류가 발생했어요.",
      });
    }
  }

  const files = await db.sourceFile.findMany({
    where: { contextPackId: packId },
    orderBy: { createdAt: "asc" },
  });

  if (files.length > 0 && files.every((f) => f.analyzedAt !== null)) {
    await db.contextPack.update({
      where: { id: packId },
      data: { analyzedAt: new Date() },
    });
  }

  return { files, updatedCount: updated.length, errors };
}

export async function runResearchStep(packId: string): Promise<ResearchStepResult> {
  const pack = await loadPack(packId);
  const unanalyzed = pack.files.filter((f) => !f.analyzedAt);
  if (pack.files.length === 0 || unanalyzed.length > 0) {
    throw new PipelineError("먼저 파일 분석을 완료해주세요.", "research");
  }

  const provider = getResearchProvider();
  const result = await provider.research({
    issue: pack.issue,
    industry: pack.industry,
    topics: pack.files.map((f) => f.topic).filter((t): t is string => Boolean(t)),
  });

  let contextPack;
  try {
    contextPack = await db.contextPack.update({
      where: { id: packId },
      data: {
        researchResult: serializeResearchResult(result),
        researchedAt: new Date(),
        researchStatus: "completed",
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) {
      throw new PipelineError("Context Pack이 조사 중 삭제되었어요.", "research", 404);
    }
    throw err;
  }

  return { contextPack, research: result };
}

export async function runGenerateStep(packId: string): Promise<GenerateStepResult> {
  const pack = await loadPack(packId);
  if (pack.files.length === 0) {
    throw new PipelineError("먼저 파일을 업로드해주세요.", "generate");
  }
  const unanalyzed = pack.files.filter((f) => !f.analyzedAt);
  if (unanalyzed.length > 0) {
    throw new PipelineError(
      "아직 분석되지 않은 파일이 있어요. 먼저 분석을 완료해주세요.",
      "generate",
    );
  }

  const provider = getAiProvider();
  const research = deserializeResearchResult(pack.researchResult);
  const ragQuery = [pack.issue, pack.industry, ...pack.files.map((f) => f.topic ?? "")]
    .filter(Boolean)
    .join(" ");
  const ragChunks = await retrieveRelevantChunks({
    contextPackId: packId,
    query: ragQuery,
    teamId: pack.teamId,
  });

  try {
    const result = await provider.generateMessageHouse({
      issue: pack.issue,
      industry: pack.industry,
      analyses: pack.files.map((f) => ({
        filename: f.filename,
        analysis: {
          docType: f.docType ?? "",
          topic: f.topic ?? "",
          claim: f.claim ?? "",
          numbers: f.numbers ?? "",
          terms: f.terms ?? "",
          audience: f.audience ?? "",
          risk: f.risk ?? "",
        },
      })),
      research,
      ragChunks,
    });

    const contextPack = await db.contextPack.update({
      where: { id: packId },
      data: {
        roofMessage: result.roofMessage,
        pillars: serializePillars(result.pillars),
        foundation: result.foundation,
        objections: serializeStringList(result.objections),
        aieoSummary: result.aieoSummary,
        riskFlags: serializeStringList(result.riskFlags),
        forbiddenTerms: result.forbiddenTerms,
        officialTerms: result.officialTerms,
        status: "review",
        generatedAt: new Date(),
        confirmedAt: null,
        gateMessageReviewed: false,
        gateNoConfidential: false,
        gateNumbersVerified: false,
      },
    });

    return { contextPack };
  } catch (err) {
    if (isRecordNotFoundError(err)) {
      throw new PipelineError("Context Pack이 생성 중 삭제되었어요.", "generate", 404);
    }
    const message =
      err instanceof AiResponseParseError
        ? err.message
        : err instanceof Error
          ? err.message
          : "메시지하우스 생성 중 오류가 발생했어요.";
    throw new PipelineError(message, "generate", 502);
  }
}

export type { PipelineError };
