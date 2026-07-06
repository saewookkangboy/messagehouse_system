import { describe, expect, it } from "vitest";
import type { Pillar } from "./ai/schema";
import {
  deriveFoundationItems,
  extractMetricPhrases,
  isRawNumberDump,
  joinFoundationItems,
  joinFoundations,
  looksLikeMetricText,
  splitFoundation,
  splitFoundationItems,
} from "./foundation";

const pillar: Pillar = {
  id: "P1",
  theme: "테마",
  message: "메시지",
  evidence: "추출 근거",
  foundation: "",
  source: "file_extracted",
};

const rawDump =
  "2021, 2016, 2022, 2℃, 104, 76-79, 77, 80-83, 81, 84-85, 85, 13-22, 14, 16, 25-29, 30";

describe("isRawNumberDump", () => {
  it("detects page-number style dumps", () => {
    expect(isRawNumberDump(rawDump)).toBe(true);
    expect(looksLikeMetricText(rawDump)).toBe(false);
  });
});

describe("extractMetricPhrases", () => {
  it("pulls readable metrics from report sentences", () => {
    expect(
      extractMetricPhrases("2019년부터 지속가능경영보고서 발간 (다섯 번째 보고서)"),
    ).toEqual(expect.arrayContaining(["2019년부터", "다섯 번째 보고서"]));
  });

  it("pulls percentages from pillar messages", () => {
    expect(extractMetricPhrases("경쟁사 대비 보험 가입 시간 30% 단축")).toEqual(["30%"]);
  });
});

describe("deriveFoundationItems", () => {
  it("maps file analysis fields to foundation bullets", () => {
    expect(
      deriveFoundationItems(pillar, 0, [
        { claim: "핵심 주장", numbers: "92%, 2026Q1", topic: "가입 혁신" },
      ]),
    ).toEqual(["추출 근거", "92% · 2026Q1", "메시지"]);
  });

  it("prefers readable generated foundation text when present", () => {
    expect(
      deriveFoundationItems(
        {
          ...pillar,
          foundation: "생성 근거 · 92% 만족 · 생성 사례",
        },
        0,
        [{ claim: "파일 주장", numbers: rawDump, topic: "파일 주제" }],
      ),
    ).toEqual(["생성 근거", "92%", "생성 사례"]);
  });

  it("ignores raw number dumps and uses pillar evidence instead", () => {
    expect(
      deriveFoundationItems(
        {
          ...pillar,
          evidence: "2019년부터 지속가능경영보고서 발간 (다섯 번째 보고서)",
          message: "지속가능경영보고서를 꾸준히 발간하고 있어요.",
          foundation: `2019년부터 지속가능경영보고서 발간 · ${rawDump} · 보고서 발간 사례`,
        },
        0,
        [{ claim: "보고서 발간", numbers: rawDump, topic: "지속가능경영" }],
      ),
    ).toEqual([
      "2019년부터 지속가능경영보고서 발간 (다섯 번째 보고서)",
      expect.stringMatching(/2019년|다섯 번째/),
      "보고서 발간 사례",
    ]);
  });

  it("keeps pillar-specific metrics across columns", () => {
    const files = [{ claim: "공통 주장", numbers: rawDump, topic: "공통 주제" }];

    const p1 = deriveFoundationItems(
      {
        ...pillar,
        id: "P1",
        evidence: "2019년부터 지속가능경영보고서 발간 (다섯 번째 보고서)",
        message: "지속가능경영보고서 발간",
        foundation: "",
      },
      0,
      files,
    );
    const p2 = deriveFoundationItems(
      {
        ...pillar,
        id: "P2",
        evidence: "GRI, UNGC, SASB, TCFD, PSI 등 글로벌 작성 가이드라인 준수",
        message: "글로벌 가이드라인을 준수해요.",
        foundation: "",
      },
      1,
      files,
    );
    const p3 = deriveFoundationItems(
      {
        ...pillar,
        id: "P3",
        evidence: "한국표준협회 제3자 검증 완료",
        message: "경쟁사 대비 보험 가입 시간 30% 단축",
        foundation: "",
        source: "file_extracted",
      },
      2,
      files,
    );

    expect(p1[1]).toMatch(/2019년|다섯 번째/);
    expect(p2[1]).toBe("원본 자료에서 확인되지 않았어요");
    expect(p3[1]).toBe("30%");
  });
});

describe("splitFoundationItems", () => {
  it("splits a pillar foundation into three labeled items", () => {
    expect(splitFoundationItems("근거 A · 수치 B · 사례 C")).toEqual([
      "근거 A",
      "수치 B",
      "사례 C",
    ]);
  });

  it("pads missing items to three slots", () => {
    expect(splitFoundationItems("근거만")).toEqual(["근거만", "", ""]);
  });
});

describe("joinFoundationItems", () => {
  it("joins non-empty foundation items", () => {
    expect(joinFoundationItems(["근거", "", "사례"])).toBe("근거 · 사례");
  });
});

describe("splitFoundation", () => {
  it("splits up to three pillar foundations from a legacy string", () => {
    expect(splitFoundation("A · B · C · D")).toEqual(["A", "B", "C · D"]);
  });
});

describe("joinFoundations", () => {
  it("joins non-empty pillar foundations", () => {
    expect(joinFoundations(["A", "", "C"])).toBe("A · C");
  });
});
