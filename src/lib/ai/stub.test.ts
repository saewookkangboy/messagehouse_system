import { describe, expect, it } from "vitest";
import { DocumentAnalysisSchema, MessageHouseSchema } from "./schema";
import { StubAiProvider } from "./stub";

describe("StubAiProvider", () => {
  it("returns a schema-valid document analysis", async () => {
    const provider = new StubAiProvider();
    const result = await provider.analyzeDocument({
      filename: "test.txt",
      text: "아무 내용",
    });
    expect(() => DocumentAnalysisSchema.parse(result)).not.toThrow();
  });

  it("rotates between two analysis variants across calls", async () => {
    const provider = new StubAiProvider();
    const first = await provider.analyzeDocument({ filename: "a.txt", text: "" });
    const second = await provider.analyzeDocument({ filename: "b.txt", text: "" });
    const third = await provider.analyzeDocument({ filename: "c.txt", text: "" });
    expect(first.topic).not.toBe(second.topic);
    expect(third.topic).toBe(first.topic);
  });

  it("returns a schema-valid message house with exactly 3 pillars", async () => {
    const provider = new StubAiProvider();
    const result = await provider.generateMessageHouse({
      issue: "테스트 이슈",
      analyses: [],
    });
    expect(() => MessageHouseSchema.parse(result)).not.toThrow();
    expect(result.pillars).toHaveLength(3);
  });

  it("weaves the research result into the research_enhanced pillar when provided", async () => {
    const provider = new StubAiProvider();
    const result = await provider.generateMessageHouse({
      issue: "테스트 이슈",
      analyses: [],
      research: {
        news: ["뉴스"],
        industryTrends: ["보험 업계 디지털 전환 가속화"],
        competitorMoves: ["경쟁사 동향"],
        regulations: ["규제"],
        aieoKeywords: ["키워드"],
        differentiationPoint: "경쟁사 대비 가입 시간 30% 추가 단축",
      },
    });
    const researchPillar = result.pillars.find((p) => p.source === "research_enhanced");
    expect(researchPillar?.message).toBe("경쟁사 대비 가입 시간 30% 추가 단축");
    expect(result.foundation).toContain("보험 업계 디지털 전환 가속화");
  });
});
