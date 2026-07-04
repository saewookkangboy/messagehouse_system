/**
 * 활성 팀 전환 라우트 — 멤버십 검증.
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn(), resolveSwitchableTeam: vi.fn() };
});

const { requireAuth, resolveSwitchableTeam } = await import("@/lib/auth/session");
const { POST } = await import("./route");

const ctx = {
  user: { id: "u1", email: "a@b.c", name: "t" },
  teamId: "t1",
  teamName: "T",
  role: "editor" as const,
};

function req(body: unknown) {
  return new Request("http://localhost/api/team/switch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/team/switch", () => {
  it("로그인하지 않으면 401", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await POST(req({ teamId: "t2" }));
    expect(res.status).toBe(401);
  });

  it("소속되지 않은 팀으로는 403", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(ctx);
    vi.mocked(resolveSwitchableTeam).mockResolvedValueOnce(null);
    const res = await POST(req({ teamId: "not-my-team" }));
    expect(res.status).toBe(403);
  });

  it("멤버인 팀으로 전환하면 활성 팀 쿠키를 설정해요", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(ctx);
    vi.mocked(resolveSwitchableTeam).mockResolvedValueOnce("t2");
    const res = await POST(req({ teamId: "t2" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("mh_active_team=t2");
  });

  it("teamId가 없으면 400", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(ctx);
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
