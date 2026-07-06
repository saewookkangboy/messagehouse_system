import { afterEach, describe, expect, it, vi } from "vitest";
import { BgeM3KoEmbeddingProvider } from "./bgeM3Ko";

describe("BgeM3KoEmbeddingProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("embeds queries without asymmetric instruction prefixes", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body)) as { inputs: string };
        bodies.push(payload.inputs);
        return new Response(JSON.stringify([[0.1, 0.2, 0.3]]), { status: 200 });
      }),
    );

    const provider = new BgeM3KoEmbeddingProvider("hf_test");
    await provider.embedQuery("한국어 검색 쿼리");
    await provider.embed(["한국어 문서 청크"]);

    expect(bodies[0]).toBe("한국어 검색 쿼리");
    expect(bodies[1]).toBe("한국어 문서 청크");
    expect(bodies[0]).not.toMatch(/Represent this sentence/i);
  });
});
