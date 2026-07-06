import type { MessageHouse, Pillar } from "./ai/schema";
import { FOUNDATION_ITEM_LABELS, splitFoundationItems } from "./foundation";
import {
  attachObject,
  attachTopic,
  objectParticle,
  polishKoreanParticles,
  stripTrailingParticles,
} from "./koreanJosa";

const EMPTY_FOUNDATION = "원본 자료에서 확인되지 않았어요";
export const MAX_PILLAR_MESSAGE_LENGTH = 100;
const MAX_CLAUSE_LENGTH = 40;

function trimClause(text: string): string {
  const trimmed = text.trim().replace(/[.…]+$/, "");
  if (trimmed.length <= MAX_CLAUSE_LENGTH) return trimmed;

  const cut = trimmed.slice(0, MAX_CLAUSE_LENGTH);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("·"));
  if (boundary >= 14) return cut.slice(0, boundary).trim();
  return cut.trim();
}

function usableFoundationItem(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed !== EMPTY_FOUNDATION;
}

/** issue(주제)에서 기업/브랜드명 라벨을 추출합니다. */
export function extractSubjectLabel(issue: string): string {
  const trimmed = issue.trim();
  if (!trimmed) return "해당 기업";

  const companyMatch = trimmed.match(
    /^([\p{L}\p{N}]+(?:생명|화재|손보|증권|그룹|홀딩스|은행|카드|코퍼레이션|Inc|Corp)?)/u,
  );
  if (companyMatch?.[1]) return companyMatch[1];

  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord || trimmed.slice(0, 16);
}

export function isCompleteSentence(text: string): boolean {
  const trimmed = text.trim();
  return /(?:요|다|니다|죠|세요|해요|있어요|습니다|주세요)\.?$/.test(trimmed);
}

function fitSentence(sentence: string): string {
  const normalized = polishKoreanParticles(sentence.trim());
  if (normalized.length <= MAX_PILLAR_MESSAGE_LENGTH) return normalized;

  const companyEnd = normalized.indexOf("는 ");
  const altEnd = normalized.indexOf("은 ");
  const splitAt = companyEnd > 0 ? companyEnd : altEnd;
  if (splitAt > 0) {
    const company = normalized.slice(0, splitAt);
    const shortened = trimClause(stripTrailingParticles(normalized.slice(splitAt + 2)));
    const compact = `${attachTopic(company)} ${attachObject(shortened)} 핵심 메시지로 전달해요.`;
    if (compact.length <= MAX_PILLAR_MESSAGE_LENGTH) return compact;
  }

  return normalized.slice(0, MAX_PILLAR_MESSAGE_LENGTH - 1).trimEnd() + "…";
}

/** 기반(근거·수치·사례)과 기업명으로 완전한 기둥 메시지 문장을 조합합니다. */
export function composeConcisePillarMessage(
  items: [string, string, string],
  subject = "",
): string {
  const company = extractSubjectLabel(subject);
  const [evidence, metric, caseStudy] = items;

  const ev = usableFoundationItem(evidence) ? trimClause(evidence) : "";
  const met = usableFoundationItem(metric) ? trimClause(metric) : "";
  const cs =
    usableFoundationItem(caseStudy) && caseStudy.trim() !== evidence.trim()
      ? trimClause(caseStudy)
      : "";

  let sentence = "";
  if (ev && met) {
    sentence = `${attachTopic(company)} ${attachObject(ev)} 근거로 ${met} 성과를 보여주고 있어요.`;
  } else if (ev && cs) {
    sentence = `${attachTopic(company)} ${attachObject(ev)} 바탕으로 ${attachObject(cs)} 전달해요.`;
  } else if (ev) {
    sentence = `${attachTopic(company)} ${attachObject(ev)} 핵심 메시지로 전달해요.`;
  } else if (met) {
    sentence = `${attachTopic(company)} ${met} 성과를 핵심 메시지로 전달해요.`;
  } else if (cs) {
    sentence = `${attachTopic(company)} ${attachObject(cs)} 핵심 사례로 전달해요.`;
  } else {
    return `${company}의 원본 자료 기반 메시지를 확인해주세요.`;
  }

  return fitSentence(sentence);
}

export function conciseTrim(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_PILLAR_MESSAGE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_PILLAR_MESSAGE_LENGTH - 1).trimEnd() + "…";
}

export function messageGroundedInFoundation(
  message: string,
  items: [string, string, string],
): boolean {
  const msg = message.trim().toLowerCase();
  if (!msg) return false;

  return items
    .filter(usableFoundationItem)
    .some((item) => {
      const clause = trimClause(item).toLowerCase();
      return (
        clause.length >= 4 &&
        (msg.includes(clause.slice(0, 8)) || clause.includes(msg.slice(0, 8)))
      );
    });
}

export function refinePillarMessage(pillar: Pillar, issue = ""): Pillar {
  const foundationItems = splitFoundationItems(pillar.foundation);
  const composed = composeConcisePillarMessage(foundationItems, issue);
  const current = pillar.message.trim();
  const subject = extractSubjectLabel(issue);

  const shouldReplace =
    !current ||
    !isCompleteSentence(current) ||
    (subject.length >= 2 && !current.includes(subject)) ||
    current.length > MAX_PILLAR_MESSAGE_LENGTH ||
    !messageGroundedInFoundation(current, foundationItems);

  return {
    ...pillar,
    message: shouldReplace ? composed : conciseTrim(current),
  };
}

export function refineMessageHousePillars(
  house: MessageHouse,
  issue = "",
): MessageHouse {
  return {
    ...house,
    pillars: house.pillars.map((pillar) => refinePillarMessage(pillar, issue)),
  };
}

export type PillarMessageIssue = {
  pillarId: string;
  message: string;
};

/** 기둥 메시지가 기반·기업명·완전한 문장인지 검수합니다. */
export function validatePillarMessages(
  house: MessageHouse,
  issue = "",
): PillarMessageIssue[] {
  const issues: PillarMessageIssue[] = [];
  const subject = extractSubjectLabel(issue);

  for (const pillar of house.pillars) {
    const items = splitFoundationItems(pillar.foundation);
    const message = pillar.message.trim();

    if (message.length > MAX_PILLAR_MESSAGE_LENGTH) {
      issues.push({
        pillarId: pillar.id,
        message: `기둥 ${pillar.id} 메시지가 ${MAX_PILLAR_MESSAGE_LENGTH}자를 넘어요.`,
      });
      continue;
    }

    if (!isCompleteSentence(message)) {
      issues.push({
        pillarId: pillar.id,
        message: `기둥 ${pillar.id} 메시지가 완전한 문장 형태가 아니에요.`,
      });
    }

    if (subject.length >= 2 && !message.includes(subject)) {
      issues.push({
        pillarId: pillar.id,
        message: `기둥 ${pillar.id} 메시지에 '${subject}'가 포함되지 않았어요.`,
      });
    }

    if (!messageGroundedInFoundation(message, items)) {
      issues.push({
        pillarId: pillar.id,
        message: `기둥 ${pillar.id} 메시지가 기반(${FOUNDATION_ITEM_LABELS.join("·")})과 연결되지 않았어요.`,
      });
    }
  }

  return issues;
}
