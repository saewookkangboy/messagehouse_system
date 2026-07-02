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
      aieoKeywords: ["AI 보험 심사", "디지털 보험 가입", "언더라이팅 자동화"],
      differentiationPoint: "경쟁사 대비 가입 시간 30% 추가 단축",
    };
  }
}
