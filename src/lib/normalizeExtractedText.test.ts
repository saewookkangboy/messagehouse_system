import { describe, expect, it } from "vitest";
import { fixBrokenLineBreaks, normalizeExtractedText } from "./normalizeExtractedText";

describe("fixBrokenLineBreaks", () => {
  it("joins Korean lines split mid-sentence", () => {
    const input = "한화생명은 신상품 출시를\n통해 시장 점유율을 확대합니다.";
    expect(fixBrokenLineBreaks(input)).toBe(
      "한화생명은 신상품 출시를 통해 시장 점유율을 확대합니다.",
    );
  });

  it("keeps paragraph breaks", () => {
    const input = "첫 번째 문단입니다.\n\n두 번째 문단입니다.";
    expect(fixBrokenLineBreaks(input)).toBe("첫 번째 문단입니다.\n\n두 번째 문단입니다.");
  });
});

describe("normalizeExtractedText", () => {
  it("removes PDF page footers and normalizes markdown tables", () => {
    const input = [
      "MessageHouse Test Document",
      "| Core topic: | New product launch | plan |",
      "| --- | --- | --- |",
      "| Key numbers: | Revenue target | 12 billion won |",
      "",
      "-- 1 of 1 --",
    ].join("\n");

    const out = normalizeExtractedText(input);
    expect(out).toContain("MessageHouse Test Document");
    expect(out).toContain("Core topic: · New product launch · plan");
    expect(out).not.toContain("---");
    expect(out).not.toContain("1 of 1");
  });

  it("strips markdown headings while keeping Korean content", () => {
    const input = "# 핵심 주제\n\n**매출 목표** 120억원";
    expect(normalizeExtractedText(input)).toBe("핵심 주제\n\n매출 목표 120억원");
  });

  it("strips HTML table tags from kordoc output", () => {
    const input = "<tr><td>셀1</td><td>셀2</td></tr>";
    expect(normalizeExtractedText(input)).toBe("셀1 셀2");
  });

  it("fixes Korean particle spacing", () => {
    expect(normalizeExtractedText("한화생명 은 지속가능경영보고서를 발간합니다.")).toBe(
      "한화생명은 지속가능경영보고서를 발간합니다.",
    );
  });

  it("normalizes Unicode to NFC", () => {
    // NFD: ᄒ + ᅡ + ᆫ vs NFC: 한
    const nfd = "한글".normalize("NFD");
    expect(normalizeExtractedText(nfd)).toBe("한글");
  });
});
