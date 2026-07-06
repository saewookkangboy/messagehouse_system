import type { MessageHouse, Pillar } from "./ai/schema";
import { FOUNDATION_ITEM_LABELS, splitFoundationItems } from "./foundation";
import {
  attachObject,
  attachTopic,
  objectParticle,
  polishKoreanParticles,
  stripTrailingParticles,
} from "./koreanJosa";
import {
  composeConcisePillarMessage,
  extractSubjectLabel,
  isCompleteSentence,
  refineMessageHousePillars,
} from "./pillarMessage";

const EMPTY_FOUNDATION = "원본 자료에서 확인되지 않았어요";

function usableItem(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed !== EMPTY_FOUNDATION;
}

function trimCore(text: string, max = 48): string {
  const base = stripTrailingParticles(text.trim().replace(/[.…]+$/, ""));
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("·"));
  return (boundary >= 12 ? cut.slice(0, boundary) : cut).trim();
}

/** 지붕 — 우산 메시지 */
export function composeRoofMessage(
  issue: string,
  core: string,
  industry?: string | null,
): string {
  const company = extractSubjectLabel(issue);
  const topic = trimCore(core);
  if (!topic) {
    return `${attachTopic(company)} 핵심 우산 메시지를 전달해요.`;
  }
  if (industry?.trim()) {
    return `${attachTopic(company)} ${industry.trim()} 분야에서 ${attachObject(topic)} 대표 우산 메시지로 전달해요.`;
  }
  return `${attachTopic(company)} ${attachObject(topic)} 대표 우산 메시지로 전달해요.`;
}

/** 기반 bullet — 근거·수치·사례 */
export function composeFoundationSentence(
  label: (typeof FOUNDATION_ITEM_LABELS)[number],
  item: string,
  issue: string,
): string {
  if (!usableItem(item)) return item;

  const company = extractSubjectLabel(issue);
  const noun = trimCore(item, 40);

  switch (label) {
    case "근거":
      return `${attachTopic(company)} ${attachObject(noun)} 핵심 근거로 확인했어요.`;
    case "수치":
      return `${company}의 ${noun} 수치가 원문에 명시되어 있어요.`;
    case "사례":
      return `${attachTopic(company)} ${noun} 사례를 보유하고 있어요.`;
    default: {
      const exhaustive: never = label;
      return exhaustive;
    }
  }
}

/** 오해 방지 문장 */
export function composeObjectionLine(issue: string, index: number): string {
  const company = attachTopic(extractSubjectLabel(issue));
  if (index === 0) {
    return `${company} 관련 핵심 사실은 업로드된 원문과 대조해 확인해주세요.`;
  }
  return `외부 배포 전 ${company} 메시지는 법무·경영진 검토가 필요해요.`;
}

export function normalizeObjectionLine(line: string, issue: string, index: number): string {
  const trimmed = polishKoreanParticles(line.trim());
  if (!trimmed || !isCompleteSentence(trimmed)) {
    return composeObjectionLine(issue, index);
  }
  return trimmed;
}

/** AIEO Layer */
export function composeAieoSummary(
  issue: string,
  pillars: Pillar[],
  industry?: string | null,
): string {
  const company = extractSubjectLabel(issue);
  const themes = pillars
    .map((pillar) => pillar.theme.trim())
    .filter(Boolean)
    .slice(0, 3);
  const themePhrase = themes.join(", ");
  const anchor = themes.at(-1) ?? themePhrase;
  const domain = industry?.trim() || "핵심";
  if (themePhrase) {
    return `${attachTopic(company)} ${attachObject(anchor)} 중심으로 ${domain} 메시지를 AI가 인용하기 쉬운 형태로 요약해요.`;
  }
  return `${attachTopic(company)} ${domain} 메시지를 AI 검색·인용에 적합한 형태로 요약해요.`;
}

export function normalizeAieoSummary(
  text: string,
  issue: string,
  pillars: Pillar[],
  industry?: string | null,
): string {
  const trimmed = polishKoreanParticles(text.trim());
  if (!trimmed || !isCompleteSentence(trimmed) || trimmed.includes("을(를)")) {
    return composeAieoSummary(issue, pillars, industry);
  }
  return trimmed;
}

/** Risk Flags */
export function normalizeRiskFlagLine(line: string): string {
  const trimmed = polishKoreanParticles(line.trim());
  if (!trimmed) return "AI가 생성한 수치·표현은 원본 문서와 대조해 확인해주세요.";

  if (isCompleteSentence(trimmed)) return trimmed;

  const core = trimCore(trimmed, 56);
  if (/확인|검토|주의|필요|제거|수정/.test(core)) {
    return `${core}${objectParticle(core)} 반드시 사람이 확인해야 해요.`;
  }
  return `${core} 관련 내용은 원문과 대조해 확인해주세요.`;
}

function roofCoreFromHouse(house: MessageHouse, pillars: Pillar[]): string {
  const first = pillars[0];
  if (first?.evidence?.trim()) return first.evidence;
  if (first?.theme?.trim()) return first.theme;
  return stripTrailingParticles(house.roofMessage);
}

/** 메시지하우스 전 영역 문장을 자연스러운 한국어로 정리합니다. */
export function refineNaturalMessageHouse(
  house: MessageHouse,
  issue: string,
  industry?: string | null,
): MessageHouse {
  const pillars = refineMessageHousePillars(house, issue).pillars.map((pillar) => ({
    ...pillar,
    message: polishKoreanParticles(
      composeConcisePillarMessage(splitFoundationItems(pillar.foundation), issue),
    ),
  }));

  const roofMessage = composeRoofMessage(issue, roofCoreFromHouse(house, pillars), industry);

  const objections =
    house.objections.length > 0
      ? house.objections.map((line, index) => normalizeObjectionLine(line, issue, index))
      : [composeObjectionLine(issue, 0), composeObjectionLine(issue, 1)];

  const aieoSummary = normalizeAieoSummary(house.aieoSummary, issue, pillars, industry);

  const riskFlags =
    house.riskFlags.length > 0
      ? house.riskFlags.map(normalizeRiskFlagLine)
      : ["AI가 생성한 수치·표현은 원본 문서와 대조해 확인해주세요."];

  return {
    ...house,
    roofMessage,
    pillars,
    objections,
    aieoSummary,
    riskFlags,
  };
}
