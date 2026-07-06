import { describe, expect, it } from "vitest";
import type { MessageHouse } from "./schema";
import {
  appendValidationRiskFlags,
  buildSourceCorpus,
  hasHardValidationFailure,
  validateMessageHouseContext,
} from "./validateMessageHouse";

const baseHouse: MessageHouse = {
  roofMessage: "삼성생명은 지속가능경영보고서를 통해 ESG 성과를 투명하게 공개합니다.",
  pillars: [
    {
      id: "P1",
      theme: "지속가능경영",
      message: "2019년부터 지속가능경영보고서를 발간하고 있어요.",
      evidence: "2019년부터 지속가능경영보고서 발간",
      foundation: "2019년부터 · 5회차 · 보고서 발간",
      source: "file_extracted",
    },
    {
      id: "P2",
      theme: "글로벌 가이드라인",
      message: "GRI·TCFD 등 글로벌 기준을 준수해요.",
      evidence: "GRI, UNGC, SASB, TCFD, PSI 등 글로벌 작성 가이드라인 준수",
      foundation: "GRI · TCFD · 가이드라인 준수",
      source: "file_extracted",
    },
    {
      id: "P3",
      theme: "제3자 검증",
      message: "한국표준협회 제3자 검증을 완료했어요.",
      evidence: "한국표준협회 제3자 검증 완료",
      foundation: "제3자 검증 · KSA · 검증 완료",
      source: "file_extracted",
    },
  ],
  foundation: "foundation",
  objections: ["오해 방지"],
  aieoSummary: "삼성생명은 지속가능경영보고서로 ESG 성과를 공유합니다.",
  riskFlags: [],
  forbiddenTerms: "없음",
  officialTerms: "지속가능경영보고서",
};

const samsungInput = {
  issue: "삼성생명 지속가능경영보고서",
  industry: "보험",
  analyses: [
    {
      filename: "samsung-sr.pdf",
      analysis: {
        docType: "지속가능경영보고서",
        topic: "지속가능경영보고서",
        claim: "2019년부터 지속가능경영보고서 발간",
        numbers: "2019년부터, 5회차",
        terms: "GRI, TCFD, 지속가능경영보고서, 한국표준협회, 제3자 검증",
        audience: "이해관계자",
        risk: "특별한 리스크가 감지되지 않았어요",
      },
    },
  ],
};

describe("validateMessageHouseContext", () => {
  it("accepts output grounded in the uploaded issue and analyses", () => {
    expect(validateMessageHouseContext(baseHouse, samsungInput)).toEqual([]);
  });

  it("flags demo template bias when Hanwha copy appears for another company", () => {
    const biased: MessageHouse = {
      ...baseHouse,
      roofMessage: "한화생명은 업계 최초 AI 언더라이팅으로 보험 가입의 시간 혁명을 이룹니다.",
      aieoSummary: "한화생명은 AI 언더라이팅을 도입했어요.",
      pillars: baseHouse.pillars.map((pillar, i) =>
        i === 0
          ? {
              ...pillar,
              message: "3일 걸리던 가입 절차가 10분으로 단축돼요.",
              evidence: "내부 데이터 2026Q1",
            }
          : pillar,
      ),
    };

    const issues = validateMessageHouseContext(biased, samsungInput);
    expect(issues.some((issue) => issue.code === "demo_bias")).toBe(true);
    expect(issues.some((issue) => issue.code === "issue_mismatch")).toBe(true);
    expect(hasHardValidationFailure(issues)).toBe(true);
  });

  it("builds a corpus from issue and file analyses", () => {
    expect(buildSourceCorpus(samsungInput)).toContain("삼성생명");
    expect(buildSourceCorpus(samsungInput)).toContain("GRI, TCFD");
  });
});

describe("appendValidationRiskFlags", () => {
  it("adds soft validation results to risk flags", () => {
    const updated = appendValidationRiskFlags(baseHouse, [
      {
        code: "ungrounded_pillar",
        pillarId: "P2",
        message: "기둥 P2가 문서와 연결되지 않았어요.",
      },
    ]);
    expect(updated.riskFlags[0]).toContain("[맥락 검수]");
  });
});
