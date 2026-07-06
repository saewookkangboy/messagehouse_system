import { describe, expect, it } from "vitest";
import { ResearchResultSchema } from "./schema";
import { StubResearchProvider } from "./stub";

describe("StubResearchProvider", () => {
  it("returns a research result matching ResearchResultSchema", async () => {
    const provider = new StubResearchProvider();
    const result = await provider.research({
      issue: "AI 언더라이팅 신상품 출시",
      industry: "보험",
      topics: ["AI 언더라이팅 신상품 출시"],
    });
    expect(() => ResearchResultSchema.parse(result)).not.toThrow();
  });

  it("mentions the given issue in differentiation point", async () => {
    const provider = new StubResearchProvider();
    const result = await provider.research({
      issue: "메리츠화재 ESG",
      industry: "손해보험",
      topics: [],
    });
    expect(result.differentiationPoint).toContain("메리츠화재 ESG");
  });

  it("works without an industry", async () => {
    const provider = new StubResearchProvider();
    const result = await provider.research({ issue: "이슈", industry: null, topics: [] });
    expect(() => ResearchResultSchema.parse(result)).not.toThrow();
  });
});
