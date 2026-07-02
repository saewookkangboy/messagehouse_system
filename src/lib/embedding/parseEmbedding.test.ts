import { describe, expect, it } from "vitest";
import {
  embeddingToPgVectorLiteral,
  parseEmbeddingJson,
} from "./parseEmbedding";

describe("parseEmbeddingJson", () => {
  it("유효한 JSON 배열을 파싱해요", () => {
    expect(parseEmbeddingJson("[0.5, -0.25]")).toEqual([0.5, -0.25]);
  });

  it("잘못된 형식이면 에러", () => {
    expect(() => parseEmbeddingJson('{"a":1}')).toThrow();
  });
});

describe("embeddingToPgVectorLiteral", () => {
  it("pgvector 리터럴 문자열을 만들어요", () => {
    expect(embeddingToPgVectorLiteral([1, 2, 3])).toBe("[1,2,3]");
  });
});
