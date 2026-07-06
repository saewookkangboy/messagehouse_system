import { describe, expect, it } from "vitest";
import { DocumentAnalysisSchema, MessageHouseSchema } from "./schema";
import { StubAiProvider } from "./stub";
import { validateMessageHouseContext } from "./validateMessageHouse";

describe("StubAiProvider", () => {
  it("returns a schema-valid document analysis derived from uploaded text", async () => {
    const provider = new StubAiProvider();
    const result = await provider.analyzeDocument({
      filename: "samsung-sr.pdf",
      text: "삼성생명은 2019년부터 지속가능경영보고서를 발간합니다. 온실가스 배출 12% 감축.",
    });
    expect(() => DocumentAnalysisSchema.parse(result)).not.toThrow();
    expect(result.topic).toContain("삼성생명");
    expect(result.numbers).toContain("2019년");
  });

  it("returns different message houses for different company issues", async () => {
    const provider = new StubAiProvider();
    const analyses = [
      {
        filename: "report.pdf",
        analysis: {
          docType: "보고서",
          topic: "지속가능경영",
          claim: "2019년부터 보고서 발간",
          numbers: "2019년부터, 5회차",
          terms: "GRI, TCFD",
          audience: "이해관계자",
          risk: "특별한 리스크가 감지되지 않았어요",
        },
      },
    ];

    const samsung = await provider.generateMessageHouse({
      issue: "삼성생명 지속가능경영",
      industry: "보험",
      analyses,
    });
    const hanwha = await provider.generateMessageHouse({
      issue: "한화생명 AI 혁신",
      industry: "보험",
      analyses,
    });

    expect(samsung.roofMessage).toContain("삼성생명");
    expect(hanwha.roofMessage).toContain("한화생명");
    expect(samsung.roofMessage).not.toBe(hanwha.roofMessage);
  });

  it("returns a schema-valid message house with exactly 3 pillars", async () => {
    const provider = new StubAiProvider();
    const result = await provider.generateMessageHouse({
      issue: "테스트 이슈",
      analyses: [],
    });
    expect(() => MessageHouseSchema.parse(result)).not.toThrow();
    expect(result.pillars).toHaveLength(3);
    expect(result.roofMessage).toContain("테스트 이슈");
  });

  it("weaves the research result into the research_enhanced pillar when provided", async () => {
    const provider = new StubAiProvider();
    const result = await provider.generateMessageHouse({
      issue: "메리츠화재 ESG",
      analyses: [
        {
          filename: "report.pdf",
          analysis: {
            docType: "보고서",
            topic: "ESG",
            claim: "탄소중립 로드맵 수립",
            numbers: "2030년까지 30% 감축",
            terms: "ESG, 탄소중립",
            audience: "이해관계자",
            risk: "특별한 리스크가 감지되지 않았어요",
          },
        },
      ],
      research: {
        news: ["ESG 뉴스"],
        industryTrends: ["손해보험 ESG 공시 확대"],
        competitorMoves: ["경쟁사 ESG 보고서 발간"],
        regulations: ["규제"],
        aieoKeywords: ["ESG"],
        differentiationPoint: "업계 평균 대비 공시 범위 20% 확대",
      },
    });
    const researchPillar = result.pillars.find((p) => p.source === "research_enhanced");
    expect(researchPillar?.message).toContain("메리츠화재");
    expect(researchPillar?.message).toMatch(/요\.?$|습니다\.?$/);
    expect(result.roofMessage).toContain("메리츠화재");
  });

  it("passes context validation for company-specific output", async () => {
    const provider = new StubAiProvider();
    const analyses = [
      {
        filename: "report.pdf",
        analysis: {
          docType: "지속가능경영보고서",
          topic: "지속가능경영보고서",
          claim: "2019년부터 지속가능경영보고서 발간",
          numbers: "2019년부터, 5회차",
          terms: "GRI, TCFD",
          audience: "이해관계자",
          risk: "특별한 리스크가 감지되지 않았어요",
        },
      },
    ];
    const result = await provider.generateMessageHouse({
      issue: "삼성생명 지속가능경영보고서",
      industry: "보험",
      analyses,
    });

    expect(
      validateMessageHouseContext(result, {
        issue: "삼성생명 지속가능경영보고서",
        industry: "보험",
        analyses,
      }),
    ).toEqual([]);
  });
});
