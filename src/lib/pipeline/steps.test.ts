/**
 * 파이프라인 단계 가드 조건 — AI 호출 이전에 단락되는 검증 로직.
 * happy-path는 Stub 프로바이더로 강제해 네트워크 없이 검증해요.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { PipelineError } from "./schema";
import { runAnalyzeStep, runResearchStep, runGenerateStep } from "./steps";

const RUN = `steps-${Date.now()}`;
let teamId = "";
let packId = "";

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: RUN } } });
  await db.team.deleteMany({ where: { name: RUN } });
}

beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "stub");
  vi.stubEnv("RESEARCH_PROVIDER", "stub");
  vi.stubEnv("EMBEDDING_PROVIDER", "stub");
  await cleanup();
  teamId = (await db.team.create({ data: { name: RUN } })).id;
  packId = (await db.contextPack.create({ data: { issue: "단계 테스트", teamId } })).id;
});

afterEach(() => vi.unstubAllEnvs());
afterAll(cleanup);

describe("runAnalyzeStep 가드", () => {
  it("파일이 없으면 PipelineError(analyze)", async () => {
    await expect(runAnalyzeStep(packId)).rejects.toBeInstanceOf(PipelineError);
    await expect(runAnalyzeStep(packId)).rejects.toMatchObject({ step: "analyze" });
  });

  it("존재하지 않는 팩이면 PipelineError(404)", async () => {
    await expect(runAnalyzeStep("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("runResearchStep 가드", () => {
  it("파일이 없으면 PipelineError(research)", async () => {
    await expect(runResearchStep(packId)).rejects.toMatchObject({ step: "research" });
  });

  it("분석되지 않은 파일이 있으면 PipelineError(research)", async () => {
    await db.sourceFile.create({
      data: { contextPackId: packId, filename: "a.txt", mimeType: "text/plain", sizeBytes: 10, extractedText: "내용" },
    });
    await expect(runResearchStep(packId)).rejects.toMatchObject({ step: "research" });
  });
});

describe("runGenerateStep 가드", () => {
  it("파일이 없으면 PipelineError(generate)", async () => {
    await expect(runGenerateStep(packId)).rejects.toMatchObject({ step: "generate" });
  });

  it("분석되지 않은 파일이 있으면 PipelineError(generate)", async () => {
    await db.sourceFile.create({
      data: { contextPackId: packId, filename: "a.txt", mimeType: "text/plain", sizeBytes: 10, extractedText: "내용" },
    });
    await expect(runGenerateStep(packId)).rejects.toMatchObject({ step: "generate" });
  });
});

describe("runAnalyzeStep happy-path (Stub 프로바이더)", () => {
  it("파일을 분석하고 analyzedAt을 채워요", async () => {
    await db.sourceFile.create({
      data: {
        contextPackId: packId,
        filename: "press.txt",
        mimeType: "text/plain",
        sizeBytes: 30,
        extractedText: "한화생명 신상품 출시 보도자료입니다.",
      },
    });
    const result = await runAnalyzeStep(packId);
    expect(result.errors).toEqual([]);
    expect(result.updatedCount).toBe(1);
    expect(result.files[0]?.analyzedAt).not.toBeNull();
    expect(result.files[0]?.docType).toBeTruthy();
  });
});
