import { describe, expect, it } from "vitest";
import { buildInviteEmail, buildInvitePath, isInvitableRole } from "./invite";

describe("invite helpers", () => {
  it("builds invite path from token", () => {
    expect(buildInvitePath("abc123")).toBe("/invite/abc123");
  });

  it("validates invitable roles", () => {
    expect(isInvitableRole("editor")).toBe(true);
    expect(isInvitableRole("owner")).toBe(false);
  });

  it("builds an invite email with the team, role, and link", () => {
    const email = buildInviteEmail({
      teamName: "PR팀",
      role: "editor",
      invitedByName: "김보람",
      inviteUrl: "https://example.com/invite/abc123",
    });
    expect(email.subject).toContain("PR팀");
    expect(email.subject).toContain("김보람");
    expect(email.text).toContain("편집자");
    expect(email.text).toContain("https://example.com/invite/abc123");
  });
});
