import { describe, expect, it } from "vitest";
import type { MessageHouse, Pillar } from "./ai/schema";
import {
  composeConcisePillarMessage,
  extractSubjectLabel,
  isCompleteSentence,
  messageGroundedInFoundation,
  refinePillarMessage,
  validatePillarMessages,
} from "./pillarMessage";

const pillar: Pillar = {
  id: "P1",
  theme: "지속가능경영",
  message: "2019년부터 지속가능경영보고서 발간 · 5회차",
  evidence: "2019년부터 발간",
  foundation: "2019년부터 지속가능경영보고서 발간 · 5회차 · 보고서 발간 사례",
  source: "file_extracted",
};

describe("extractSubjectLabel", () => {
  it("extracts company name from issue", () => {
    expect(extractSubjectLabel("삼성생명 지속가능경영보고서")).toBe("삼성생명");
  });
});

describe("composeConcisePillarMessage", () => {
  it("builds a complete sentence with company name from foundation items", () => {
    const message = composeConcisePillarMessage(
      ["2019년부터 지속가능경영보고서 발간", "5회차", "보고서 발간 사례"],
      "삼성생명 지속가능경영",
    );
    expect(message).toContain("삼성생명");
    expect(isCompleteSentence(message)).toBe(true);
    expect(message).not.toContain(" · ");
  });

  it("skips empty foundation slots", () => {
    const message = composeConcisePillarMessage(
      ["GRI·TCFD 가이드라인 준수", "원본 자료에서 확인되지 않았어요", "검증 완료 사례"],
      "메리츠화재 ESG",
    );
    expect(message).toContain("메리츠화재");
    expect(isCompleteSentence(message)).toBe(true);
  });
});

describe("refinePillarMessage", () => {
  it("replaces fragment messages with complete company sentences", () => {
    const refined = refinePillarMessage(pillar, "삼성생명 ESG");
    expect(refined.message).toContain("삼성생명");
    expect(isCompleteSentence(refined.message)).toBe(true);
    expect(
      messageGroundedInFoundation(refined.message, [
        "2019년부터 지속가능경영보고서 발간",
        "5회차",
        "보고서 발간 사례",
      ]),
    ).toBe(true);
  });
});

describe("validatePillarMessages", () => {
  it("flags fragment messages without company name", () => {
    const house: MessageHouse = {
      roofMessage: "지붕",
      pillars: [pillar, pillar, pillar],
      foundation: "",
      objections: ["o"],
      aieoSummary: "a",
      riskFlags: [],
      forbiddenTerms: "f",
      officialTerms: "o",
    };
    const issues = validatePillarMessages(house, "삼성생명 ESG");
    expect(issues.some((issue) => issue.message.includes("완전한 문장"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("삼성생명"))).toBe(true);
  });

  it("flags verbose messages", () => {
    const verbosePillar: Pillar = {
      ...pillar,
      message: "A".repeat(110) + "요.",
      foundation: "완전히 다른 근거 · 다른 수치 · 다른 사례",
    };
    const house: MessageHouse = {
      roofMessage: "지붕",
      pillars: [verbosePillar],
      foundation: "",
      objections: ["o"],
      aieoSummary: "a",
      riskFlags: [],
      forbiddenTerms: "f",
      officialTerms: "o",
    };
    const issues = validatePillarMessages(house, "삼성생명");
    expect(issues.some((issue) => issue.message.includes("100자"))).toBe(true);
  });
});
