import { describe, expect, it } from "vitest";
import {
  compareRetrievalResults,
  formatRegressionReport,
} from "./regression";

describe("compareRetrievalResults", () => {
  it("Top-K 순서·텍스트가 같으면 ok", () => {
    const chunks = [
      {
        filename: "a.txt",
        chunkIndex: 0,
        text: "hello",
        score: 0.91,
        source: "pack" as const,
      },
      {
        filename: "a.txt",
        chunkIndex: 1,
        text: "world",
        score: 0.82,
        source: "pack" as const,
      },
    ];

    const result = compareRetrievalResults({
      query: "test",
      sqlite: chunks,
      pg: chunks.map((c) => ({ ...c, score: c.score + 1e-6 })),
    });

    expect(result.ok).toBe(true);
  });

  it("순서가 다르면 rank mismatch", () => {
    const a = {
      filename: "a.txt",
      chunkIndex: 0,
      text: "first",
      score: 0.9,
      source: "pack" as const,
    };
    const b = {
      filename: "a.txt",
      chunkIndex: 1,
      text: "second",
      score: 0.8,
      source: "pack" as const,
    };

    const result = compareRetrievalResults({
      query: "test",
      sqlite: [a, b],
      pg: [b, a],
    });

    expect(result.ok).toBe(false);
    expect(result.rankMismatches.length).toBeGreaterThan(0);
  });

  it("formatRegressionReport 요약", () => {
    const report = formatRegressionReport([
      {
        ok: true,
        query: "q1",
        sqliteTopK: [],
        pgTopK: [],
        rankMismatches: [],
        scoreMismatches: [],
      },
      {
        ok: false,
        query: "q2",
        sqliteTopK: [],
        pgTopK: [],
        rankMismatches: [{ rank: 0 }],
        scoreMismatches: [],
      },
    ]);
    expect(report).toContain("1 passed, 1 failed");
  });
});
