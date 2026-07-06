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
    const long = "가".repeat(1_500);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.length).toBeLessThanOrEqual(1200);
  });

  it("prefers Korean sentence boundaries when splitting long text", () => {
    const sentence = "핵심 주장입니다. ";
    const long = sentence.repeat(121).trim();
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.endsWith("입니다."))).toBe(true);
  });

  it("merges small paragraphs into one chunk when possible", () => {
    const text = "첫 문단입니다.\n\n둘째 문단입니다.";
    expect(chunkText(text)).toEqual(["첫 문단입니다.\n\n둘째 문단입니다."]);
  });
});
