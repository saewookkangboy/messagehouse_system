import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaudeAiProvider } from "./claude";
import { GeminiAiProvider } from "./gemini";
import { getAiProvider, _resetAiProviderForTests } from "./index";
import { StubAiProvider } from "./stub";

describe("getAiProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetAiProviderForTests();
  });

  it("defaults to StubAiProvider when nothing is configured", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getAiProvider()).toBeInstanceOf(StubAiProvider);
  });

  it("uses ClaudeAiProvider automatically when an API key is present", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
    expect(getAiProvider()).toBeInstanceOf(ClaudeAiProvider);
  });

  it("uses GeminiAiProvider automatically when only a Gemini key is present", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    expect(getAiProvider()).toBeInstanceOf(GeminiAiProvider);
  });

  it("prefers ClaudeAiProvider over Gemini when both keys are present", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    expect(getAiProvider()).toBeInstanceOf(ClaudeAiProvider);
  });

  it("respects an explicit AI_PROVIDER=stub override even with a key present", () => {
    vi.stubEnv("AI_PROVIDER", "stub");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
    expect(getAiProvider()).toBeInstanceOf(StubAiProvider);
  });

  it("respects an explicit AI_PROVIDER=gemini override even with a Claude key present", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    expect(getAiProvider()).toBeInstanceOf(GeminiAiProvider);
  });

  it("throws a clear error for AI_PROVIDER=claude with no key", () => {
    vi.stubEnv("AI_PROVIDER", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => getAiProvider()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("throws a clear error for AI_PROVIDER=gemini with no key", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(() => getAiProvider()).toThrow(/GEMINI_API_KEY/);
  });
});
