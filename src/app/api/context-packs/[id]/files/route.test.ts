/**
 * 파일 업로드 라우트 — editor 강제 경로.
 * 인증 실패는 파일 처리 이전에 단락돼요.
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn(), assertPackTeamAccess: vi.fn() };
});

const { requireAuth } = await import("@/lib/auth/session");
const { POST } = await import("./route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/context-packs/[id]/files — 강제 경로", () => {
  it("로그인하지 않으면 401을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await POST(
      new Request("http://localhost/x", { method: "POST" }),
      makeParams("p1"),
    );
    expect(res.status).toBe(401);
  });

  it("editor 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError("이 작업을 수행할 권한이 없어요.", 403),
    );
    const res = await POST(
      new Request("http://localhost/x", { method: "POST" }),
      makeParams("p1"),
    );
    expect(res.status).toBe(403);
  });
});
