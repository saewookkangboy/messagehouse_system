import { z } from "zod";
import { PillarSchema, type Pillar } from "./ai/schema";
import { ResearchResultSchema, type ResearchResult } from "./research/schema";

export function serializePillars(pillars: Pillar[]): string {
  return JSON.stringify(pillars);
}

export function deserializePillars(raw: string | null | undefined): Pillar[] {
  if (!raw) return [];
  return z.array(PillarSchema).parse(JSON.parse(raw));
}

export function serializeStringList(items: string[]): string {
  return JSON.stringify(items);
}

export function deserializeStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return z.array(z.string()).parse(JSON.parse(raw));
}

export function serializeResearchResult(result: ResearchResult): string {
  return JSON.stringify(result);
}

export function deserializeResearchResult(
  raw: string | null | undefined,
): ResearchResult | null {
  if (!raw) return null;
  return ResearchResultSchema.parse(JSON.parse(raw));
}

/**
 * PRD H-구간: 사람이 반드시 확인해야 하는 3개 게이트. 셋 다 체크돼야
 * Context Pack을 confirmed 상태로 전환할 수 있어요 — 서버에서 강제해요.
 */
export function canConfirm(gates: {
  gateMessageReviewed: boolean;
  gateNoConfidential: boolean;
  gateNumbersVerified: boolean;
}): boolean {
  return (
    gates.gateMessageReviewed && gates.gateNoConfidential && gates.gateNumbersVerified
  );
}
