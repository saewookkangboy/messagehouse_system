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
import { buildRagContextForAnalysis, indexSourceFile, retrieveRelevantChunks } from "@/lib/rag";
import { decryptField } from "@/lib/fieldCrypto";
import { checkRateLimit } from "@/lib/rateLimit";
import { joinFoundations, splitFoundation } from "@/lib/foundation";
import type { MessageHouse } from "@/lib/ai/schema";
import {
  appendValidationRiskFlags,
  formatValidationErrors,
  hasHardValidationFailure,
  validateMessageHouseContext,
} from "@/lib/ai/validateMessageHouse";
import {
  refineMessageHousePillars,
  validatePillarMessages,
} from "@/lib/pillarMessage";
import { refineNaturalMessageHouse } from "@/lib/messageHouseSentence";
import type {
  AnalyzeStepResult,
  GenerateStepResult,
  PackWithFiles,
  PipelineStep,
  ResearchStepResult,
} from "./schema";
import { PipelineError } from "./schema";

function isRecordNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/** AI/리서치 프로바이더 호출 비용 남용 방지 — 팀당 10분에 30회. */
async function assertPipelineRateLimit(pack: PackWithFiles, step: PipelineStep): Promise<void> {
  const { allowed } = await checkRateLimit(`pipeline:${step}:${pack.teamId}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!allowed) {
    throw new PipelineError(
      "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
      step,
      429,
    );
  }
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
  await assertPipelineRateLimit(pack, "analyze");

  const provider = getAiProvider();
  const pending = pack.files.filter((f) => !f.analyzedAt);
  const updated = [];
  const errors: AnalyzeStepResult["errors"] = [];

  for (const file of pending) {
    try {
      const chunkCount = await db.documentChunk.count({ where: { sourceFileId: file.id } });
      if (chunkCount === 0) {
        await indexSourceFile(file.id);
      }
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
  await assertPipelineRateLimit(pack, "research");

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

function normalizeMessageHouse(
  result: MessageHouse,
  issue = "",
  industry?: string | null,
): MessageHouse {
  const legacyParts = splitFoundation(result.foundation);
  const pillars = result.pillars.map((pillar, i) => ({
    ...pillar,
    foundation: pillar.foundation?.trim() || legacyParts[i] || "",
  }));

  const normalized = {
    ...result,
    pillars,
    foundation: joinFoundations(pillars.map((pillar) => pillar.foundation)),
  };

  return refineNaturalMessageHouse(normalized, issue, industry);
}

function validateGeneratedMessageHouse(
  result: MessageHouse,
  pack: Pick<PackWithFiles, "issue" | "industry" | "files">,
): MessageHouse {
  const analyses = pack.files.map((f) => ({
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
  }));

  const issues = validateMessageHouseContext(result, {
    issue: pack.issue,
    industry: pack.industry,
    analyses,
  });

  if (hasHardValidationFailure(issues)) {
    throw new PipelineError(
      `메시지하우스 맥락 검수에 실패했어요. ${formatValidationErrors(issues)}`,
      "generate",
      502,
    );
  }

  const pillarIssues = validatePillarMessages(result, pack.issue);
  const withPillarFlags = appendValidationRiskFlags(
    result,
    pillarIssues.map((issue) => ({
      code: "ungrounded_pillar" as const,
      pillarId: issue.pillarId,
      message: issue.message,
    })),
  );

  return appendValidationRiskFlags(withPillarFlags, issues);
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
  await assertPipelineRateLimit(pack, "generate");

  const provider = getAiProvider();
  const research = deserializeResearchResult(pack.researchResult);
  const ragQuery = [
    pack.issue,
    pack.industry,
    pack.purpose,
    pack.targetAudience,
    ...pack.files.map((f) => f.topic ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
  const ragChunks = await retrieveRelevantChunks({
    contextPackId: packId,
    query: ragQuery,
    teamId: pack.teamId,
  });

  try {
    const result = validateGeneratedMessageHouse(
      normalizeMessageHouse(
        await provider.generateMessageHouse({
      issue: pack.issue,
      industry: pack.industry,
      purpose: pack.purpose,
      targetAudience: pack.targetAudience,
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
        }),
        pack.issue,
        pack.industry,
      ),
      pack,
    );

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
