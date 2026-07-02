import type { ResearchProvider, ResearchResult } from "./schema";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilySearchResult[];
}

/**
 * Real web research via the Tavily Search API. Not runtime-verified in this
 * environment (no TAVILY_API_KEY available) — same caveat as
 * ClaudeAiProvider before its first live call. Falls back to a clear
 * placeholder string per category if Tavily returns zero results, rather
 * than fabricating data, since ResearchResultSchema requires non-empty
 * arrays.
 */
export class TavilyResearchProvider implements ResearchProvider {
  private apiKey: string;

  constructor(apiKey = process.env.TAVILY_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "TAVILY_API_KEY가 설정되지 않았어요. .env에 키를 추가하거나 RESEARCH_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.apiKey = apiKey;
  }

  private async search(
    query: string,
    options: { topic?: "general" | "news"; days?: number } = {},
  ): Promise<TavilySearchResult[]> {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        topic: options.topic ?? "general",
        ...(options.days ? { days: options.days } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily 검색 요청이 실패했어요 (${res.status}): ${query}`);
    }
    const data = (await res.json()) as TavilyResponse;
    return data.results ?? [];
  }

  private toBullets(results: TavilySearchResult[], emptyFallback: string): string[] {
    const bullets = results.map((r) => `${r.title} — ${r.content.slice(0, 120)}`);
    return bullets.length > 0 ? bullets : [emptyFallback];
  }

  async research(input: {
    issue: string;
    industry?: string | null;
    topics: string[];
  }): Promise<ResearchResult> {
    const industry = input.industry?.trim() || "";
    const subject = [input.issue, ...input.topics].filter(Boolean).join(" ");

    const [news, industryTrends, competitorMoves, regulations] = await Promise.all([
      this.search(`${subject} 뉴스`, { topic: "news", days: 30 }),
      this.search(`${industry} 업계 트렌드 시장 통계`),
      this.search(`${industry} 경쟁사 PR 신제품 발표`),
      this.search(`${industry} 규제 정책 최신 발표`),
    ]);

    const aieoKeywordResults = await this.search(`${subject} AI 검색 키워드 GEO`);
    const aieoKeywords = aieoKeywordResults
      .map((r) => r.title)
      .filter(Boolean)
      .slice(0, 5);

    return {
      news: this.toBullets(news, "최근 30일간 관련 뉴스를 찾지 못했어요."),
      industryTrends: this.toBullets(industryTrends, "관련 업계 트렌드를 찾지 못했어요."),
      competitorMoves: this.toBullets(competitorMoves, "경쟁사 관련 동향을 찾지 못했어요."),
      regulations: this.toBullets(regulations, "관련 규제·정책 변화를 찾지 못했어요."),
      aieoKeywords:
        aieoKeywords.length > 0 ? aieoKeywords : ["관련 AIEO 키워드를 찾지 못했어요"],
      differentiationPoint:
        competitorMoves[0] != null
          ? `경쟁사 동향("${competitorMoves[0].title}") 대비 차별화 지점 검토가 필요해요.`
          : "경쟁사 동향을 찾지 못해 차별화 포인트를 자동 도출하지 못했어요.",
    };
  }
}
