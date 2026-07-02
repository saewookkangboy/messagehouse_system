import type { ContextPack, ContextPackStatus } from "@/generated/prisma/client";

/** 메시지하우스 본문 필드 — 수정 시 confirmed → review 되돌림 */
export const MESSAGE_HOUSE_FIELD_KEYS = [
  "roofMessage",
  "pillars",
  "foundation",
  "objections",
  "aieoSummary",
  "riskFlags",
  "forbiddenTerms",
  "officialTerms",
] as const;

export type MessageHouseFieldKey = (typeof MESSAGE_HOUSE_FIELD_KEYS)[number];

export type ContextPackPatchBody = {
  issue?: string;
  industry?: string | null;
  roofMessage?: string;
  pillars?: unknown;
  foundation?: string;
  objections?: unknown;
  aieoSummary?: string;
  riskFlags?: unknown;
  forbiddenTerms?: string;
  officialTerms?: string;
  gateMessageReviewed?: boolean;
  gateNoConfidential?: boolean;
  gateNumbersVerified?: boolean;
  status?: ContextPackStatus;
};

const ALLOWED_TRANSITIONS: Record<ContextPackStatus, readonly ContextPackStatus[]> = {
  draft: ["draft", "review"],
  review: ["review", "confirmed"],
  confirmed: ["confirmed", "review"],
};

export class StatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusTransitionError";
  }
}

export function isAllowedStatusTransition(
  from: ContextPackStatus,
  to: ContextPackStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStatusTransition(
  from: ContextPackStatus,
  to: ContextPackStatus,
  context: { hasRoofMessage: boolean },
): void {
  if (from === to) return;

  if (!isAllowedStatusTransition(from, to)) {
    throw new StatusTransitionError(
      `상태를 '${from}'에서 '${to}'(으)로 변경할 수 없어요.`,
    );
  }

  if (from === "draft" && to === "review" && !context.hasRoofMessage) {
    throw new StatusTransitionError(
      "검토 상태로 전환하려면 먼저 메시지하우스를 생성해야 해요.",
    );
  }

  if (to === "confirmed" && from !== "review") {
    throw new StatusTransitionError(
      "확정하려면 먼저 검토(review) 상태여야 해요.",
    );
  }
}

export function touchesMessageHouseFields(body: ContextPackPatchBody): boolean {
  return MESSAGE_HOUSE_FIELD_KEYS.some((key) => body[key] !== undefined);
}

function shouldRevertFromConfirmed(
  existingStatus: ContextPackStatus,
  nextStatus: ContextPackStatus,
  messageHouseEdited: boolean,
): boolean {
  return (
    existingStatus === "confirmed" &&
    (messageHouseEdited || nextStatus === "review")
  );
}

/**
 * PATCH 본문과 기존 Pack을 합쳐 최종 update data를 계산해요.
 */
export function buildContextPackPatchData(input: {
  existing: Pick<
    ContextPack,
    | "status"
    | "roofMessage"
    | "gateMessageReviewed"
    | "gateNoConfidential"
    | "gateNumbersVerified"
    | "confirmedAt"
  >;
  body: ContextPackPatchBody;
  serialized?: Partial<
    Pick<ContextPack, "pillars" | "objections" | "riskFlags">
  >;
}): {
  data: Record<string, unknown>;
  effectiveStatus: ContextPackStatus;
} {
  const { existing, body, serialized = {} } = input;

  const mergedRoofMessage =
    body.roofMessage !== undefined ? body.roofMessage : existing.roofMessage;
  const hasRoofMessage = Boolean(mergedRoofMessage);

  const messageHouseEdited =
    existing.status === "confirmed" && touchesMessageHouseFields(body);

  let nextStatus: ContextPackStatus =
    messageHouseEdited ? "review" : (body.status ?? existing.status);

  assertStatusTransition(existing.status, nextStatus, { hasRoofMessage });

  const data: Record<string, unknown> = {};

  if (body.issue !== undefined) data.issue = body.issue;
  if (body.industry !== undefined) data.industry = body.industry;
  if (body.roofMessage !== undefined) data.roofMessage = body.roofMessage;
  if (serialized.pillars !== undefined) data.pillars = serialized.pillars;
  if (body.foundation !== undefined) data.foundation = body.foundation;
  if (serialized.objections !== undefined) data.objections = serialized.objections;
  if (body.aieoSummary !== undefined) data.aieoSummary = body.aieoSummary;
  if (serialized.riskFlags !== undefined) data.riskFlags = serialized.riskFlags;
  if (body.forbiddenTerms !== undefined) data.forbiddenTerms = body.forbiddenTerms;
  if (body.officialTerms !== undefined) data.officialTerms = body.officialTerms;

  if (body.gateMessageReviewed !== undefined) {
    data.gateMessageReviewed = body.gateMessageReviewed;
  }
  if (body.gateNoConfidential !== undefined) {
    data.gateNoConfidential = body.gateNoConfidential;
  }
  if (body.gateNumbersVerified !== undefined) {
    data.gateNumbersVerified = body.gateNumbersVerified;
  }

  const revertConfirmed = shouldRevertFromConfirmed(
    existing.status,
    nextStatus,
    messageHouseEdited,
  );

  if (revertConfirmed) {
    data.status = "review";
    data.confirmedAt = null;
    data.gateMessageReviewed = false;
    data.gateNoConfidential = false;
    data.gateNumbersVerified = false;
    nextStatus = "review";
  } else if (body.status !== undefined || nextStatus !== existing.status) {
    data.status = nextStatus;
  }

  if (nextStatus === "confirmed" && existing.status !== "confirmed") {
    data.confirmedAt = new Date();
  }

  return { data, effectiveStatus: nextStatus };
}
