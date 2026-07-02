import { z } from "zod";

// PRD F-03 리서치 범위: 최신 뉴스(30일) / 업계 트렌드 / 경쟁사 메시지 / 규제·정책 / GEO·AIEO 키워드
export const ResearchResultSchema = z.object({
  news: z.array(z.string().min(1)).min(1),
  industryTrends: z.array(z.string().min(1)).min(1),
  competitorMoves: z.array(z.string().min(1)).min(1),
  regulations: z.array(z.string().min(1)).min(1),
  aieoKeywords: z.array(z.string().min(1)).min(1),
  differentiationPoint: z.string().min(1),
});
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

export interface ResearchProvider {
  research(input: {
    issue: string;
    industry?: string | null;
    topics: string[];
  }): Promise<ResearchResult>;
}
