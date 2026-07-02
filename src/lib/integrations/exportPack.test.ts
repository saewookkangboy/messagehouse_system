import { describe, expect, it } from "vitest";
import { assertConfirmedForDestinationExport, ExportPackError } from "./exportPack";
import type { ContextPack } from "@/generated/prisma/client";

const basePack = {
  id: "p1",
  issue: "테스트",
  industry: null,
  version: "1.0",
  roofMessage: "메시지",
  pillars: null,
  foundation: null,
  objections: null,
  aieoSummary: null,
  riskFlags: null,
  forbiddenTerms: null,
  officialTerms: null,
  teamId: null,
  createdById: null,
  researchResult: null,
  researchedAt: null,
  researchStatus: "pending" as const,
  analyzedAt: null,
  generatedAt: null,
  confirmedAt: null,
  pipelineRunningStep: null,
  pipelineError: null,
  pipelineErrorStep: null,
  gateMessageReviewed: true,
  gateNoConfidential: true,
  gateNumbersVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("assertConfirmedForDestinationExport", () => {
  it("rejects non-confirmed packs", () => {
    expect(() =>
      assertConfirmedForDestinationExport({
        ...basePack,
        status: "review",
      } as ContextPack),
    ).toThrow(ExportPackError);
  });

  it("allows confirmed packs with roof message", () => {
    expect(() =>
      assertConfirmedForDestinationExport({
        ...basePack,
        status: "confirmed",
      } as ContextPack),
    ).not.toThrow();
  });
});
