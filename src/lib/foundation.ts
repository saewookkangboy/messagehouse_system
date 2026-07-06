import type { Pillar } from "./ai/schema";
import type { ResearchResult } from "./research/schema";

export type FoundationFileSource = {
  claim?: string | null;
  numbers?: string | null;
  topic?: string | null;
};

const EMPTY_FOUNDATION = "원본 자료에서 확인되지 않았어요";

const METRIC_PATTERNS = [
  /\d+(?:\.\d+)?%/g,
  /\d+(?:\.\d+)?(?:℃|°C)/g,
  /\d{4}년(?:부터|까지|간)?[^\s,.]{0,20}/g,
  /(?:제|총|약)\s*\d+(?:,\d{3})*(?:\.\d+)?(?:%|명|건|배|회|등급|위|개)/g,
  /\d+(?:,\d{3})*(?:\.\d+)?(?:%|명|건|배|회|등급|위|개)/g,
  /(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(?:번째|회째)\s*[^\s,.]{0,12}/g,
];

function pickText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return EMPTY_FOUNDATION;
}

/** 페이지·연도 나열 등 원본 추출 노이즈인지 판별합니다. */
export function isRawNumberDump(text: string): boolean {
  const tokens = text
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length <= 4) return false;

  const noise = tokens.filter(
    (token) =>
      /^\d{1,3}-\d{1,3}$/.test(token) ||
      /^(19|20)\d{2}$/.test(token) ||
      (/^\d{1,3}$/.test(token) && !token.includes("%")),
  );
  return noise.length >= Math.max(4, Math.ceil(tokens.length * 0.45));
}

export function looksLikeMetricText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || isRawNumberDump(trimmed)) return false;
  if (!/\d/.test(trimmed)) return false;
  if (trimmed.length > 120 && trimmed.split(/[,·]/).length > 5) return false;
  return true;
}

function normalizeMetricPhrase(phrase: string): string {
  return phrase.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function isNoiseToken(token: string): boolean {
  return (
    /^\d{1,3}-\d{1,3}$/.test(token) ||
    /^(19|20)\d{2}$/.test(token) ||
    (/^\d{1,3}$/.test(token) && !/%|℃|°C|명|건|배|회|등급|위|개|원/.test(token))
  );
}

/** 보고서 문장에서 설명 가능한 수치 구문을 추출합니다. */
export function extractMetricPhrases(...sources: string[]): string[] {
  const phrases = new Set<string>();

  for (const source of sources) {
    if (!source?.trim() || isRawNumberDump(source)) continue;

    for (const pattern of METRIC_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const phrase = normalizeMetricPhrase(match[0]);
        if (phrase.length >= 2 && !isNoiseToken(phrase)) {
          phrases.add(phrase);
        }
      }
    }
  }

  return [...phrases];
}

function sanitizeFileNumberTokens(raw: string | null | undefined): string[] {
  if (!raw?.trim() || isRawNumberDump(raw)) return [];

  return raw
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((token) => !isNoiseToken(token))
    .filter((token) => /\d/.test(token));
}

function formatMetricList(phrases: string[]): string {
  if (phrases.length === 0) return EMPTY_FOUNDATION;
  return phrases.slice(0, 3).join(" · ");
}

function deriveEvidence(
  generated: string,
  pillar: Pillar,
  file?: FoundationFileSource,
): string {
  const trimmed = generated.trim();
  if (trimmed && !looksLikeMetricText(trimmed) && !isRawNumberDump(trimmed)) {
    return trimmed;
  }
  return pickText(pillar.evidence, file?.topic, file?.claim);
}

function deriveNumbers(
  generated: string,
  pillar: Pillar,
  pillarIndex: number,
  file?: FoundationFileSource,
): string {
  const trimmed = generated.trim();
  if (looksLikeMetricText(trimmed)) {
    return formatMetricList(extractMetricPhrases(trimmed));
  }

  const fromPillar = extractMetricPhrases(pillar.evidence, pillar.message, trimmed);
  if (fromPillar.length > 0) {
    return formatMetricList(fromPillar);
  }

  const fileTokens = sanitizeFileNumberTokens(file?.numbers);
  if (fileTokens.length > 0 && file?.numbers && !isRawNumberDump(file.numbers)) {
    if (fileTokens.length <= 3) {
      return formatMetricList(fileTokens);
    }
    const chunk = Math.ceil(fileTokens.length / 3);
    const start = pillarIndex * chunk;
    return formatMetricList(fileTokens.slice(start, start + chunk));
  }

  return EMPTY_FOUNDATION;
}

function deriveCase(
  generated: string,
  pillar: Pillar,
  file?: FoundationFileSource,
): string {
  const trimmed = generated.trim();
  if (
    trimmed &&
    !looksLikeMetricText(trimmed) &&
    !isRawNumberDump(trimmed) &&
    trimmed !== pillar.evidence
  ) {
    return trimmed;
  }
  return pickText(pillar.message, file?.claim, file?.topic);
}

function deriveResearchNumbers(
  generated: string,
  pillar: Pillar,
  research: ResearchResult,
): string {
  const trimmed = generated.trim();
  if (looksLikeMetricText(trimmed)) {
    return formatMetricList(extractMetricPhrases(trimmed));
  }

  const fromPillar = extractMetricPhrases(
    pillar.evidence,
    pillar.message,
    research.differentiationPoint,
  );
  if (fromPillar.length > 0) {
    return formatMetricList(fromPillar);
  }

  return pickText(
    research.industryTrends.slice(0, 2).join(" · "),
    research.aieoKeywords.slice(0, 2).join(" · "),
  );
}

function deriveResearchCase(
  generated: string,
  pillar: Pillar,
  research: ResearchResult,
): string {
  const trimmed = generated.trim();
  if (
    trimmed &&
    !looksLikeMetricText(trimmed) &&
    !isRawNumberDump(trimmed) &&
    trimmed !== pillar.evidence
  ) {
    return trimmed;
  }
  return pickText(
    pillar.message,
    research.differentiationPoint,
    research.news[0],
    research.competitorMoves[0],
  );
}

/** 기둥별 Foundation 표시용 근거·수치·사례를 원본 자료에서 구성합니다. */
export function deriveFoundationItems(
  pillar: Pillar,
  pillarIndex: number,
  files: FoundationFileSource[],
  research?: ResearchResult | null,
): [string, string, string] {
  const generated = splitFoundationItems(pillar.foundation);
  const file = files.length > 0 ? files[pillarIndex % files.length] : undefined;

  if (pillar.source === "research_enhanced" && research) {
    return [
      deriveEvidence(generated[0], pillar, file),
      deriveResearchNumbers(generated[1], pillar, research),
      deriveResearchCase(generated[2], pillar, research),
    ];
  }

  return [
    deriveEvidence(generated[0], pillar, file),
    deriveNumbers(generated[1], pillar, pillarIndex, file),
    deriveCase(generated[2], pillar, file),
  ];
}

/** legacy 단일 foundation 문자열을 기둥 3개에 맞춰 나눕니다. */
export function splitFoundation(raw: string): [string, string, string] {
  const parts = raw
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return ["", "", ""];
  if (parts.length === 1) return [parts[0], "", ""];
  if (parts.length === 2) return [parts[0], parts[1], ""];
  return [parts[0], parts[1], parts.slice(2).join(" · ")];
}

/** 기둥 하나의 foundation을 근거·수치·사례 3항목으로 나눕니다. */
export function splitFoundationItems(raw: string): [string, string, string] {
  const parts = raw
    .split(/\s*·\s*/)
    .map((s) => s.trim());
  while (parts.length < 3) parts.push("");
  if (parts.length > 3) {
    return [parts[0], parts[1], parts.slice(2).join(" · ")];
  }
  return [parts[0], parts[1], parts[2]];
}

export const FOUNDATION_ITEM_LABELS = ["근거", "수치", "사례"] as const;

export function joinFoundationItems(parts: string[]): string {
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

export function joinFoundations(parts: string[]): string {
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}
