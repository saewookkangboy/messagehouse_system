import { describe, expect, it } from "vitest";
import { attachObject, attachTopic, objectParticle, topicParticle } from "./koreanJosa";
import {
  composeFoundationSentence,
  composeRoofMessage,
  refineNaturalMessageHouse,
} from "./messageHouseSentence";
import type { MessageHouse } from "./ai/schema";

describe("koreanJosa", () => {
  it("picks 은/는 by batchim", () => {
    expect(topicParticle("삼성생명")).toBe("은");
    expect(topicParticle("한화")).toBe("는");
  });

  it("picks 을/를 by batchim", () => {
    expect(objectParticle("준수")).toBe("를");
    expect(objectParticle("발간")).toBe("을");
  });

  it("attaches particles without literal placeholders", () => {
    expect(attachTopic("삼성생명")).toBe("삼성생명은");
    expect(attachObject("가이드라인 준수")).toBe("가이드라인 준수를");
  });
});

describe("messageHouseSentence", () => {
  it("composes natural roof and foundation sentences", () => {
    expect(
      composeRoofMessage("삼성생명 ESG", "지속가능경영보고서 발간", "보험"),
    ).toBe("삼성생명은 보험 분야에서 지속가능경영보고서 발간을 대표 우산 메시지로 전달해요.");

    expect(
      composeFoundationSentence("근거", "GRI·TCFD 가이드라인 준수", "삼성생명 ESG"),
    ).toBe("삼성생명은 GRI·TCFD 가이드라인 준수를 핵심 근거로 확인했어요.");
  });

  it("refines the whole message house with natural Korean", () => {
    const house: MessageHouse = {
      roofMessage: "raw",
      pillars: [
        {
          id: "P1",
          theme: "지속가능경영",
          message: "fragment",
          evidence: "2019년부터 지속가능경영보고서 발간",
          foundation: "2019년부터 지속가능경영보고서 발간 · 5회차 · 보고서 발간 사례",
          source: "file_extracted",
        },
        {
          id: "P2",
          theme: "가이드라인",
          message: "fragment",
          evidence: "GRI·TCFD 가이드라인 준수",
          foundation: "GRI·TCFD 가이드라인 준수 ·  · 사례",
          source: "file_extracted",
        },
        {
          id: "P3",
          theme: "검증",
          message: "fragment",
          evidence: "한국표준협회 제3자 검증 완료",
          foundation: "한국표준협회 제3자 검증 완료 ·  · 사례",
          source: "file_extracted",
        },
      ],
      foundation: "",
      objections: ["bad"],
      aieoSummary: "bad",
      riskFlags: ["과장 표현"],
      forbiddenTerms: "f",
      officialTerms: "o",
    };

    const refined = refineNaturalMessageHouse(house, "삼성생명 ESG", "보험");
    expect(refined.roofMessage).toContain("삼성생명은");
    expect(refined.pillars[0]?.message).toContain("삼성생명");
    expect(refined.pillars[0]?.message).not.toContain("을(를)");
    expect(refined.objections[0]).toMatch(/요\.?$/);
    expect(refined.aieoSummary).toContain("삼성생명");
    expect(refined.riskFlags[0]).toMatch(/요\.?$/);
  });
});
