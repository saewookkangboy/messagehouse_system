import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking";

describe("chunkText", () => {
  it("returns an empty array for blank input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(chunkText("짧은 문단 하나")).toEqual(["짧은 문단 하나"]);
  });

  it("splits long paragraphs with overlap", () => {
    const long = "가".repeat(900);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.length).toBeLessThanOrEqual(800);
  });

  it("merges small paragraphs into one chunk when possible", () => {
    const text = "첫 문단입니다.\n\n둘째 문단입니다.";
    expect(chunkText(text)).toEqual(["첫 문단입니다.\n\n둘째 문단입니다."]);
  });
});
