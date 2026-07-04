/**
 * 계정 삭제/내보내기 라우트 — 인증 강제.
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@/lib/account", () => ({
  AccountDeletionError: class extends Error {
    statusCode = 400;
  },
  deleteAccount: vi.fn(),
  collectAccountData: vi.fn(),
}));

const { requireAuth } = await import("@/lib/auth/session");
const { deleteAccount, collectAccountData } = await import("@/lib/account");
const { DELETE } = await import("./route");
const { GET } = await import("./export/route");

describe("계정 라우트 — 인증 강제", () => {
  it("DELETE: 로그인하지 않으면 401", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("DELETE: 데모 모드(null)면 400", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(null);
    const res = await DELETE();
    expect(res.status).toBe(400);
  });

  it("DELETE: 인증 시 삭제 후 세션 쿠키를 비워요", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.c", name: "t" },
      teamId: "t1",
      teamName: "T",
      role: "owner",
    });
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("mh_session=");
    expect(vi.mocked(deleteAccount)).toHaveBeenCalledWith("u1");
  });

  it("GET export: 로그인하지 않으면 401", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET export: 인증 시 JSON 다운로드를 반환해요", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.c", name: "t" },
      teamId: "t1",
      teamName: "T",
      role: "viewer",
    });
    vi.mocked(collectAccountData).mockResolvedValueOnce({
      exportedAt: "2026-01-01",
      user: { id: "u1", email: "a@b.c", name: "t", createdAt: new Date() },
      memberships: [],
      contextPacks: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });
});
