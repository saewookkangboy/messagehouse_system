import { afterEach, describe, expect, it, vi } from "vitest";
import { BgeM3KoEmbeddingProvider } from "./bgeM3Ko";
import { OpenAiEmbeddingProvider } from "./openai";
import { StubEmbeddingProvider } from "./stub";
import { getEmbeddingProvider, _resetEmbeddingProviderForTests } from "./index";

describe("getEmbeddingProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetEmbeddingProviderForTests();
  });

  it("defaults to StubEmbeddingProvider when nothing is configured", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(getEmbeddingProvider()).toBeInstanceOf(StubEmbeddingProvider);
  });

  it("prefers BGE-m3-ko when HF_TOKEN is present", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "");
    vi.stubEnv("HF_TOKEN", "hf_test");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(getEmbeddingProvider()).toBeInstanceOf(BgeM3KoEmbeddingProvider);
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is present", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(getEmbeddingProvider()).toBeInstanceOf(OpenAiEmbeddingProvider);
  });

  it("throws for explicit bge-m3-ko without HF_TOKEN", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "bge-m3-ko");
    vi.stubEnv("HF_TOKEN", "");
    expect(() => getEmbeddingProvider()).toThrow(/HF_TOKEN/);
  });
});

describe("StubEmbeddingProvider", () => {
  it("returns 1024-dimensional normalized vectors", async () => {
    const provider = new StubEmbeddingProvider();
    const [vector] = await provider.embed(["한국어 테스트 문장"]);
    expect(vector).toHaveLength(1024);
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});
