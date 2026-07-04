/**
 * 팀 초대 라우트 — admin 강제 경로 (생성/조회/취소).
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn() };
});

const { requireAuth } = await import("@/lib/auth/session");
const { GET, POST, DELETE } = await import("./route");

describe("팀 초대 라우트 — admin 강제", () => {
  it("GET: admin 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("권한 없음", 403));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET: 로그인하지 않으면 401을 반환해요 (requireAuth null)", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST: admin 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("권한 없음", 403));
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.c", role: "editor" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE: admin 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("권한 없음", 403));
    const res = await DELETE(new Request("http://localhost/x?id=abc", { method: "DELETE" }));
    expect(res.status).toBe(403);
  });
});
