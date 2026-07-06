import { describe, expect, it } from "vitest";
import {
  canConfirm,
  deserializePillars,
  deserializeResearchResult,
  deserializeStringList,
  serializePillars,
  serializeResearchResult,
  serializeStringList,
} from "./contextPackSerialization";
import type { Pillar } from "./ai/schema";
import type { ResearchResult } from "./research/schema";

const pillars: Pillar[] = [
  {
    id: "P1",
    theme: "A",
    message: "msg-a",
    evidence: "ev-a",
    foundation: "",
    source: "file_extracted",
  },
  {
    id: "P2",
    theme: "B",
    message: "msg-b",
    evidence: "ev-b",
    foundation: "",
    source: "research_enhanced",
  },
];

describe("pillar serialization", () => {
  it("round-trips pillars through JSON", () => {
    const stored = serializePillars(pillars);
    expect(deserializePillars(stored)).toEqual(pillars);
  });

  it("returns an empty array for null/empty input", () => {
    expect(deserializePillars(null)).toEqual([]);
    expect(deserializePillars("")).toEqual([]);
  });

  it("rejects malformed stored data instead of silently returning garbage", () => {
    expect(() => deserializePillars('[{"id":"P1"}]')).toThrow();
  });
});

describe("string list serialization", () => {
  it("round-trips a string list through JSON", () => {
    const items = ["첫 번째 오해 방지 문장", "두 번째 오해 방지 문장"];
    expect(deserializeStringList(serializeStringList(items))).toEqual(items);
  });

  it("returns an empty array for null input", () => {
    expect(deserializeStringList(null)).toEqual([]);
  });
});

describe("research result serialization", () => {
  const research: ResearchResult = {
    news: ["뉴스 1"],
    industryTrends: ["트렌드 1"],
    competitorMoves: ["경쟁사 동향 1"],
    regulations: ["규제 1"],
    aieoKeywords: ["키워드 1"],
    differentiationPoint: "차별화 포인트",
  };

  it("round-trips a research result through JSON", () => {
    const stored = serializeResearchResult(research);
    expect(deserializeResearchResult(stored)).toEqual(research);
  });

  it("returns null for null/empty input", () => {
    expect(deserializeResearchResult(null)).toBeNull();
    expect(deserializeResearchResult("")).toBeNull();
  });

  it("rejects malformed stored data instead of silently returning garbage", () => {
    expect(() => deserializeResearchResult('{"news":[]}')).toThrow();
  });
});

describe("canConfirm", () => {
  it("is true only when all three H-구간 gates are checked", () => {
    expect(
      canConfirm({
        gateMessageReviewed: true,
        gateNoConfidential: true,
        gateNumbersVerified: true,
      }),
    ).toBe(true);
  });

  it.each([
    [false, true, true],
    [true, false, true],
    [true, true, false],
    [false, false, false],
  ])(
    "is false when any gate is unchecked (%s, %s, %s)",
    (gateMessageReviewed, gateNoConfidential, gateNumbersVerified) => {
      expect(
        canConfirm({ gateMessageReviewed, gateNoConfidential, gateNumbersVerified }),
      ).toBe(false);
    },
  );
});
