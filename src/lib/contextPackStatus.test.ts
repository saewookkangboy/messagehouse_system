import { describe, expect, it } from "vitest";
import {
  assertStatusTransition,
  buildContextPackPatchData,
  isAllowedStatusTransition,
  StatusTransitionError,
} from "./contextPackStatus";

const baseExisting = {
  status: "review" as const,
  roofMessage: "지붕 메시지",
  gateMessageReviewed: true,
  gateNoConfidential: true,
  gateNumbersVerified: true,
  confirmedAt: null,
};

describe("isAllowedStatusTransition", () => {
  it("허용된 전이만 true", () => {
    expect(isAllowedStatusTransition("draft", "review")).toBe(true);
    expect(isAllowedStatusTransition("review", "confirmed")).toBe(true);
    expect(isAllowedStatusTransition("confirmed", "review")).toBe(true);
    expect(isAllowedStatusTransition("confirmed", "draft")).toBe(false);
    expect(isAllowedStatusTransition("draft", "confirmed")).toBe(false);
  });
});

describe("assertStatusTransition", () => {
  it("draft → confirmed 는 거부", () => {
    expect(() =>
      assertStatusTransition("draft", "confirmed", { hasRoofMessage: true }),
    ).toThrow(StatusTransitionError);
  });

  it("roofMessage 없이 draft → review 는 거부", () => {
    expect(() =>
      assertStatusTransition("draft", "review", { hasRoofMessage: false }),
    ).toThrow(StatusTransitionError);
  });
});

describe("buildContextPackPatchData", () => {
  it("confirmed 전환 시 confirmedAt 설정", () => {
    const { data, effectiveStatus } = buildContextPackPatchData({
      existing: baseExisting,
      body: { status: "confirmed" },
    });
    expect(effectiveStatus).toBe("confirmed");
    expect(data.confirmedAt).toBeInstanceOf(Date);
  });

  it("confirmed Pack 메시지 수정 시 review로 되돌리고 게이트 초기화", () => {
    const { data, effectiveStatus } = buildContextPackPatchData({
      existing: {
        ...baseExisting,
        status: "confirmed",
        confirmedAt: new Date(),
      },
      body: { roofMessage: "수정된 지붕" },
    });
    expect(effectiveStatus).toBe("review");
    expect(data.status).toBe("review");
    expect(data.confirmedAt).toBeNull();
    expect(data.gateMessageReviewed).toBe(false);
    expect(data.gateNoConfidential).toBe(false);
    expect(data.gateNumbersVerified).toBe(false);
  });

  it("confirmed → review 명시 전환 시 confirmedAt·게이트 초기화", () => {
    const { data, effectiveStatus } = buildContextPackPatchData({
      existing: {
        ...baseExisting,
        status: "confirmed",
        confirmedAt: new Date(),
      },
      body: { status: "review" },
    });
    expect(effectiveStatus).toBe("review");
    expect(data.confirmedAt).toBeNull();
    expect(data.gateMessageReviewed).toBe(false);
  });
});
