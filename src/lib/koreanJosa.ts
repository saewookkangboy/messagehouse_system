/** 한글 받침 유무로 은/는 · 을/를 등 조사를 선택합니다. */

export function hasJongseong(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function lastKoreanChar(text: string): string {
  const matches = text.match(/[\p{Script=Hangul}]/gu);
  return matches?.at(-1) ?? text.trim().slice(-1);
}

export function pickJosa<T extends readonly [string, string]>(
  word: string,
  pair: T,
): T[number] {
  return (hasJongseong(lastKoreanChar(word)) ? pair[0] : pair[1]) as T[number];
}

export function topicParticle(word: string): "은" | "는" {
  return pickJosa(word, ["은", "는"] as const);
}

export function subjectParticle(word: string): "이" | "가" {
  return pickJosa(word, ["이", "가"] as const);
}

export function objectParticle(word: string): "을" | "를" {
  return pickJosa(word, ["을", "를"] as const);
}

export function stripTrailingParticles(text: string): string {
  return text.trim().replace(/(은|는|이|가|을|를|과|와|으로|로)$/u, "").trim();
}

export function attachTopic(word: string): string {
  const base = stripTrailingParticles(word);
  return `${base}${topicParticle(base)}`;
}

export function attachObject(word: string): string {
  const base = stripTrailingParticles(word);
  return `${base}${objectParticle(base)}`;
}

/** 어색한 조사 표기(을(를) 등)를 문맥에 맞게 정리합니다. */
export function polishKoreanParticles(text: string): string {
  return text.replace(
    /([\p{Script=Hangul}A-Za-z0-9·%℃]+?)을\(를\)/gu,
    (_, word: string) => attachObject(word),
  );
}
