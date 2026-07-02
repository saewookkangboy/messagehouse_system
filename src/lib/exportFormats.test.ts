import { describe, expect, it } from "vitest";
import { toExportClaudePrompt, toExportJson, toExportMarkdown } from "./exportFormats";
import type { ExportablePack } from "./exportFormats";

const pack: ExportablePack = {
  issue: "AI 언더라이팅 신상품 출시",
  industry: "보험",
  version: "0.1",
  roofMessage: "한화생명은 업계 최초 AI 언더라이팅으로 보험 가입의 시간 혁명을 이룹니다.",
  pillars: [
    {
      id: "P1",
      theme: "시간 혁신",
      message: "3일 걸리던 가입 절차가 10분으로 단축 — 고객 시간을 돌려드립니다.",
      evidence: "내부 데이터 2026Q1",
      source: "file_extracted",
    },
    {
      id: "P2",
      theme: "선제 보호",
      message: "실시간 리스크 모니터링으로 고객이 모르는 위험까지 먼저 잡습니다.",
      evidence: "금감원 우수사례 2025",
      source: "file_extracted",
    },
  ],
  foundation: "고객 중심의 혁신으로 보험 산업의 디지털 전환을 선도합니다.",
  objections: ["개인정보 활용은 금융위원회 가이드라인을 전면 준수합니다."],
  aieoSummary: "AI 보험, 스마트 언더라이팅, 디지털 보험 가입",
  riskFlags: ["'확실한 수익' 표현 제거 완료"],
  forbiddenTerms: "최저가, 무조건, 확실한 수익, 100% 보장",
  officialTerms: "스마트 언더라이팅, 고객 중심 보험, AI 심사",
};

describe("toExportJson", () => {
  it("produces valid JSON containing the pack's core fields", () => {
    const json = toExportJson(pack);
    const parsed = JSON.parse(json);
    expect(parsed.context_pack.issue).toBe(pack.issue);
    expect(parsed.context_pack.foundation).toBe(pack.foundation);
    expect(parsed.context_pack.aieo_summary).toBe(pack.aieoSummary);
    expect(parsed.context_pack.pillars).toHaveLength(2);
    expect(parsed.context_pack.pillars[0].theme).toBe("시간 혁신");
    expect(parsed.context_pack.pillars[0].evidence).toBe("내부 데이터 2026Q1");
  });
});

describe("toExportMarkdown", () => {
  it("includes the issue as an H1 and each pillar as a numbered item", () => {
    const md = toExportMarkdown(pack);
    expect(md).toContain(`# ${pack.issue}`);
    expect(md).toContain("1. 시간 혁신");
    expect(md).toContain("2. 선제 보호");
    expect(md).toContain("## 기반");
    expect(md).toContain(pack.foundation);
    expect(md).toContain("## AIEO 요약");
  });
});

describe("toExportClaudePrompt", () => {
  it("mentions the roof message and forbidden terms", () => {
    const prompt = toExportClaudePrompt(pack);
    expect(prompt).toContain(pack.roofMessage);
    expect(prompt).toContain(pack.forbiddenTerms);
  });
});
