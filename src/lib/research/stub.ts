import type { ResearchProvider, ResearchResult } from "./schema";

/**
 * Canned research output shaped like the PRD F-03 example block. Lets the
 * research step run with zero network calls and zero API key, same pattern
 * as StubAiProvider. Swapped for TavilyResearchProvider once TAVILY_API_KEY
 * is set (see lib/research/index.ts).
 */
export class StubResearchProvider implements ResearchProvider {
  async research(input: {
    issue: string;
    industry?: string | null;
    topics: string[];
  }): Promise<ResearchResult> {
    void input.topics;
    const industry = input.industry?.trim() || "업계";
    return {
      news: [
        `${industry} 디지털 전환 관련 보도 증가 (최근 30일)`,
        `"${input.issue}" 관련 소비자 반응 기사 다수 게재`,
      ],
      industryTrends: [`${industry} 디지털 전환 가속화 (2026 업계 보고서)`],
      competitorMoves: ["A사 AI 심사 도입 발표 (2026.05)"],
      regulations: ["금융위원회 AI 활용 가이드라인 시행 (2026.03)"],
      aieoKeywords: [
        input.issue,
        `${industry} 트렌드`,
        input.topics[0] ?? "핵심 키워드",
      ].filter(Boolean),
      differentiationPoint: `${input.issue} 관련 ${industry} 맥락에서 차별화 포인트`,
    };
  }
}
