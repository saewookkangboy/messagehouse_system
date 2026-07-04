/**
 * 파이프라인 라우트(analyze) 강제 경로 테스트.
 * authorizePack이 실패하면 AI 단계 이전에 단락되므로 실제 AI 호출 없이 검증돼요.
 * research/generate 라우트도 동일한 authorizePack(editor) 패턴을 씁니다.
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn(), assertPackTeamAccess: vi.fn() };
});

const { requireAuth, assertPackTeamAccess } = await import("@/lib/auth/session");
const { POST } = await import("./route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/context-packs/[id]/analyze — 강제 경로", () => {
  it("로그인하지 않으면 401을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), makeParams("p1"));
    expect(res.status).toBe(401);
  });

  it("editor 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError("이 작업을 수행할 권한이 없어요.", 403),
    );
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), makeParams("p1"));
    expect(res.status).toBe(403);
  });

  it("다른 팀의 팩이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "u1", email: "a@b.c", name: "t" },
      teamId: "team1",
      teamName: "T",
      role: "editor",
    });
    vi.mocked(assertPackTeamAccess).mockRejectedValueOnce(
      new AuthError("접근 불가", 403),
    );
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), makeParams("p1"));
    expect(res.status).toBe(403);
  });
});
