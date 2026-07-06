import { describe, expect, it } from "vitest";
import type { PackWithFiles } from "./schema";
import { derivePipelineStatus } from "./status";

function pack(overrides: Partial<PackWithFiles> = {}): PackWithFiles {
  return {
    id: "pack-1",
    issue: "테스트 이슈",
    industry: null,
    purpose: null,
    targetAudience: null,
    status: "draft",
    version: "0.1",
    teamId: null,
    createdById: null,
    roofMessage: null,
    pillars: null,
    foundation: null,
    objections: null,
    aieoSummary: null,
    riskFlags: null,
    forbiddenTerms: null,
    officialTerms: null,
    researchResult: null,
    researchedAt: null,
    researchStatus: "pending",
    analyzedAt: null,
    generatedAt: null,
    confirmedAt: null,
    pipelineRunningStep: null,
    pipelineError: null,
    pipelineErrorStep: null,
    gateMessageReviewed: false,
    gateNoConfidential: false,
    gateNumbersVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [],
    ...overrides,
  };
}

describe("derivePipelineStatus", () => {
  it("파일 없으면 upload 단계", () => {
    const status = derivePipelineStatus(pack());
    expect(status.currentStep).toBe("upload");
    expect(status.steps.upload).toBe("pending");
  });

  it("분석 전이면 analyze 단계", () => {
    const status = derivePipelineStatus(
      pack({
        files: [
          {
            id: "f1",
            contextPackId: "pack-1",
            filename: "a.md",
            mimeType: "text/markdown",
            sizeBytes: 10,
            extractedText: "text",
            docType: null,
            topic: null,
            claim: null,
            numbers: null,
            terms: null,
            audience: null,
            risk: null,
            analyzedAt: null,
            createdAt: new Date(),
          },
        ],
      }),
    );
    expect(status.currentStep).toBe("analyze");
    expect(status.steps.upload).toBe("done");
  });

  it("분석 완료·리서치 전이면 research 단계", () => {
    const analyzedAt = new Date();
    const status = derivePipelineStatus(
      pack({
        files: [
          {
            id: "f1",
            contextPackId: "pack-1",
            filename: "a.md",
            mimeType: "text/markdown",
            sizeBytes: 10,
            extractedText: "text",
            docType: "보도자료",
            topic: "주제",
            claim: "주장",
            numbers: "1",
            terms: "용어",
            audience: "독자",
            risk: "없음",
            analyzedAt,
            createdAt: new Date(),
          },
        ],
      }),
    );
    expect(status.currentStep).toBe("research");
    expect(status.steps.analyze).toBe("done");
    expect(status.canGenerate).toBe(false);
  });

  it("리서치 완료 후 generate 가능", () => {
    const analyzedAt = new Date();
    const status = derivePipelineStatus(
      pack({
        researchStatus: "completed",
        researchResult: JSON.stringify({
          news: [],
          industryTrends: [],
          competitorMoves: [],
          regulations: [],
          aieoKeywords: [],
          differentiationPoint: "차별화",
        }),
        files: [
          {
            id: "f1",
            contextPackId: "pack-1",
            filename: "a.md",
            mimeType: "text/markdown",
            sizeBytes: 10,
            extractedText: "text",
            docType: "보도자료",
            topic: "주제",
            claim: "주장",
            numbers: "1",
            terms: "용어",
            audience: "독자",
            risk: "없음",
            analyzedAt,
            createdAt: new Date(),
          },
        ],
      }),
    );
    expect(status.currentStep).toBe("generate");
    expect(status.canGenerate).toBe(true);
  });
});
