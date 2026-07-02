import { afterEach, describe, expect, it, vi } from "vitest";
import { cosineSimilarity, l2Normalize } from "./cosine";

describe("cosineSimilarity", () => {
  it("returns 1 for identical normalized vectors", () => {
    const v = l2Normalize([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});
