import { describe, expect, it } from "vitest";
import { buildInvitePath, isInvitableRole } from "./invite";

describe("invite helpers", () => {
  it("builds invite path from token", () => {
    expect(buildInvitePath("abc123")).toBe("/invite/abc123");
  });

  it("validates invitable roles", () => {
    expect(isInvitableRole("editor")).toBe(true);
    expect(isInvitableRole("owner")).toBe(false);
  });
});
