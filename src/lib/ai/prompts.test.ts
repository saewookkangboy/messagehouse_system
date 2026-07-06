import { describe, expect, it } from "vitest";
import { buildAnalyzePrompt, buildGeneratePrompt } from "./prompts";

describe("buildAnalyzePrompt", () => {
  it("instructs a non-empty fallback for numbers and terms when absent", () => {
    const prompt = buildAnalyzePrompt("메모.txt", "아무 내용");
    expect(prompt).toContain("포함된 수치가 없어요");
    expect(prompt).toContain("특별한 공식 용어 없음");
    expect(prompt).toContain("빈 문자열");
  });
});

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

  it("requires company-specific grounding and forbids demo copy-paste", () => {
    const prompt = buildGeneratePrompt({
      issue: "삼성생명 ESG",
      industry: "보험",
      analyses: [
        {
          filename: "report.pdf",
          analysis: {
            docType: "보고서",
            topic: "ESG",
            claim: "탄소 감축",
            numbers: "12%",
            terms: "ESG",
            audience: "이해관계자",
            risk: "없음",
          },
        },
      ],
    });
    expect(prompt).toContain("맥락 정합성");
    expect(prompt).toContain("삼성생명 ESG");
    expect(prompt).toContain("데모 문구");
  });
});
