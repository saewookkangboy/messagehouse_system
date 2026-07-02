import { afterEach, describe, expect, it, vi } from "vitest";
import { TavilyResearchProvider } from "./tavily";
import { getResearchProvider, _resetResearchProviderForTests } from "./index";
import { StubResearchProvider } from "./stub";

describe("getResearchProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetResearchProviderForTests();
  });

  it("defaults to StubResearchProvider when nothing is configured", () => {
    vi.stubEnv("RESEARCH_PROVIDER", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    expect(getResearchProvider()).toBeInstanceOf(StubResearchProvider);
  });

  it("uses TavilyResearchProvider automatically when an API key is present", () => {
    vi.stubEnv("RESEARCH_PROVIDER", "");
    vi.stubEnv("TAVILY_API_KEY", "tvly-test-key");
    expect(getResearchProvider()).toBeInstanceOf(TavilyResearchProvider);
  });

  it("respects an explicit RESEARCH_PROVIDER=stub override even with a key present", () => {
    vi.stubEnv("RESEARCH_PROVIDER", "stub");
    vi.stubEnv("TAVILY_API_KEY", "tvly-test-key");
    expect(getResearchProvider()).toBeInstanceOf(StubResearchProvider);
  });

  it("throws a clear error for RESEARCH_PROVIDER=tavily with no key", () => {
    vi.stubEnv("RESEARCH_PROVIDER", "tavily");
    vi.stubEnv("TAVILY_API_KEY", "");
    expect(() => getResearchProvider()).toThrow(/TAVILY_API_KEY/);
  });
});
