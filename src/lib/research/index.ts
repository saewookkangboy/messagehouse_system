import type { ResearchProvider } from "./schema";
import { StubResearchProvider } from "./stub";
import { TavilyResearchProvider } from "./tavily";

export * from "./schema";

let cached: ResearchProvider | undefined;

/**
 * Selection order:
 * - RESEARCH_PROVIDER=stub   -> always the canned demo data (no network, no key)
 * - RESEARCH_PROVIDER=tavily -> always the real Tavily API (throws if no key)
 * - unset                    -> TAVILY_API_KEY if present, else stub
 */
export function getResearchProvider(): ResearchProvider {
  if (cached) return cached;

  const mode = process.env.RESEARCH_PROVIDER;
  if (mode === "stub") {
    cached = new StubResearchProvider();
  } else if (mode === "tavily") {
    cached = new TavilyResearchProvider();
  } else if (process.env.TAVILY_API_KEY) {
    cached = new TavilyResearchProvider();
  } else {
    cached = new StubResearchProvider();
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized provider between runs. */
export function _resetResearchProviderForTests(): void {
  cached = undefined;
}
