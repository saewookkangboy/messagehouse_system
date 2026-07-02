import { describe, expect, it } from "vitest";
import { MessageHouseSchema } from "./schema";

const baseMessageHouse = {
  roofMessage: "테스트 지붕 메시지",
  pillars: [
    {
      id: "P1",
      theme: "테마1",
      message: "메시지1",
      evidence: "근거1",
      source: "file_extracted" as const,
    },
    {
      id: "P2",
      theme: "테마2",
      message: "메시지2",
      evidence: "근거2",
      source: "file_extracted" as const,
    },
    {
      id: "P3",
      theme: "테마3",
      message: "메시지3",
      evidence: "근거3",
      source: "research_enhanced" as const,
    },
  ],
  foundation: "근거 A · 근거 B",
  objections: ["오해 방지 1"],
  aieoSummary: "AIEO 요약",
  riskFlags: ["리스크 1"],
};

describe("MessageHouseSchema", () => {
  it("accepts valid comma-separated terms", () => {
    const result = MessageHouseSchema.parse({
      ...baseMessageHouse,
      forbiddenTerms: "최저가, 무조건",
      officialTerms: "공식 용어 A, 공식 용어 B",
    });
    expect(result.forbiddenTerms).toBe("최저가, 무조건");
    expect(result.officialTerms).toBe("공식 용어 A, 공식 용어 B");
  });

  it("normalizes empty forbiddenTerms to a fallback", () => {
    const result = MessageHouseSchema.parse({
      ...baseMessageHouse,
      forbiddenTerms: "",
      officialTerms: "공식 용어",
    });
    expect(result.forbiddenTerms).toBe("특별히 금지할 표현 없음");
  });

  it("normalizes empty officialTerms to a fallback", () => {
    const result = MessageHouseSchema.parse({
      ...baseMessageHouse,
      forbiddenTerms: "최저가",
      officialTerms: "   ",
    });
    expect(result.officialTerms).toBe("공식 용어 미확인");
  });

  it("joins array-shaped terms from AI responses", () => {
    const result = MessageHouseSchema.parse({
      ...baseMessageHouse,
      forbiddenTerms: ["최저가", "무조건"],
      officialTerms: ["스마트 언더라이팅", "고객 중심 보험"],
    });
    expect(result.forbiddenTerms).toBe("최저가, 무조건");
    expect(result.officialTerms).toBe("스마트 언더라이팅, 고객 중심 보험");
  });
});
