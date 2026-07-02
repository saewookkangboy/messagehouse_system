import { describe, expect, it } from "vitest";
import { buildGeneratePrompt } from "./prompts";

describe("buildGeneratePrompt", () => {
  it("includes RAG chunks when provided", () => {
    const prompt = buildGeneratePrompt({
      issue: "AI 보험",
      analyses: [],
      ragChunks: [
        {
          filename: "보도자료.pdf",
          chunkIndex: 0,
          text: "가입 시간 10분 단축 실적",
          score: 0.92,
        },
      ],
    });
    expect(prompt).toContain("[RAG 검색");
    expect(prompt).toContain("조직 문서 라이브러리");
    expect(prompt).toContain("가입 시간 10분 단축 실적");
  });
});
