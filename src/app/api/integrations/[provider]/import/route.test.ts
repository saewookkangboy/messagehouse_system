/**
 * 외부 문서 가져오기 라우트 — 인증·프로바이더 강제. 실제 외부 API는 모킹해요.
 */
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn(), resolveTeamId: vi.fn(async () => "team1") };
});

vi.mock("@/lib/integrations/importDocument", () => ({
  importDocumentToOrgLibrary: vi.fn(async () => ({ id: "doc1", title: "가져온 문서" })),
  listImportableDocuments: vi.fn(),
}));

const { requireAuth } = await import("@/lib/auth/session");
const { importDocumentToOrgLibrary } = await import("@/lib/integrations/importDocument");
const { POST } = await import("./route");

const ctx = {
  user: { id: "u1", email: "a@b.c", name: "t" },
  teamId: "team1",
  teamName: "T",
  role: "editor" as const,
};

function makeParams(provider: string) {
  return { params: Promise.resolve({ provider }) };
}
function req(body: unknown) {
  return new Request("http://localhost/api/integrations/notion/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/integrations/[provider]/import", () => {
  it("지원하지 않는 프로바이더면 400 (인증 이전에 단락)", async () => {
    // 프로바이더 검사가 requireAuth보다 먼저라 auth 목을 소비하지 않아요.
    const res = await POST(req({ externalId: "x", title: "t" }), makeParams("dropbox"));
    expect(res.status).toBe(400);
  });

  it("로그인하지 않으면 401", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await POST(req({ externalId: "x", title: "t" }), makeParams("notion"));
    expect(res.status).toBe(401);
  });

  it("editor 미만 권한이면 403", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError("이 작업을 수행할 권한이 없어요.", 403),
    );
    const res = await POST(req({ externalId: "x", title: "t" }), makeParams("notion"));
    expect(res.status).toBe(403);
  });

  it("본문이 올바르지 않으면 400", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(ctx);
    const res = await POST(req({ externalId: "" }), makeParams("notion"));
    expect(res.status).toBe(400);
  });

  it("정상 요청이면 가져오기를 실행하고 201", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(ctx);
    const res = await POST(
      req({ externalId: "page-1", title: "기획안" }),
      makeParams("notion"),
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(importDocumentToOrgLibrary)).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "notion", externalId: "page-1", title: "기획안" }),
    );
  });
});
