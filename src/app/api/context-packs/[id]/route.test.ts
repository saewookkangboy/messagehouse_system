/**
 * Context Pack [id] 라우트 통합 테스트 — 보안 강제 경로 중심.
 * auth/session은 부분 모킹(AuthError는 실제 유지)하고 본문은 실 SQLite로 검증해요.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return {
    ...actual,
    requireAuth: vi.fn(),
    assertPackTeamAccess: vi.fn(),
  };
});

const { requireAuth, assertPackTeamAccess } = await import("@/lib/auth/session");
const { GET, PATCH, DELETE } = await import("./route");

const RUN = `route-pack-${Date.now()}`;
let teamId = "";
let packId = "";

const authCtx = () => ({
  user: { id: "u1", email: `${RUN}@test.local`, name: "테스터" },
  teamId,
  teamName: RUN,
  role: "owner" as const,
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: RUN } } });
  await db.team.deleteMany({ where: { name: RUN } });
}

describe("PATCH /api/context-packs/[id] — 게이트 강제", () => {
  beforeEach(async () => {
    await cleanup();
    const team = await db.team.create({ data: { name: RUN } });
    teamId = team.id;
    const pack = await db.contextPack.create({
      data: {
        issue: "라우트 테스트",
        teamId,
        status: "review",
        roofMessage: "테스트 지붕 메시지",
      },
    });
    packId = pack.id;

    vi.mocked(requireAuth).mockResolvedValue(authCtx());
    vi.mocked(assertPackTeamAccess).mockResolvedValue(undefined);
  });

  afterAll(cleanup);

  it("로그인하지 않으면 401을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const req = new Request(`http://localhost/api/context-packs/${packId}`, {
      method: "PATCH",
      body: JSON.stringify({ issue: "변경" }),
    });
    const res = await PATCH(req, makeParams(packId));
    expect(res.status).toBe(401);
  });

  it("다른 팀의 팩이면 403을 반환해요", async () => {
    vi.mocked(assertPackTeamAccess).mockRejectedValueOnce(
      new AuthError("이 Context Pack에 접근할 권한이 없어요.", 403),
    );
    const req = new Request(`http://localhost/api/context-packs/${packId}`, {
      method: "PATCH",
      body: JSON.stringify({ issue: "변경" }),
    });
    const res = await PATCH(req, makeParams(packId));
    expect(res.status).toBe(403);
  });

  it("게이트 미체크 상태로 confirmed 전환 시 400을 반환해요", async () => {
    const req = new Request(`http://localhost/api/context-packs/${packId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    const res = await PATCH(req, makeParams(packId));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("확정");

    const fresh = await db.contextPack.findUnique({ where: { id: packId } });
    expect(fresh?.status).toBe("review");
  });

  it("게이트 전부 체크 시 confirmed로 전환돼요", async () => {
    const req = new Request(`http://localhost/api/context-packs/${packId}`, {
      method: "PATCH",
      body: JSON.stringify({
        gateMessageReviewed: true,
        gateNoConfidential: true,
        gateNumbersVerified: true,
        status: "confirmed",
      }),
    });
    const res = await PATCH(req, makeParams(packId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contextPack.status).toBe("confirmed");
  });

  it("존재하지 않는 팩이면 404를 반환해요", async () => {
    const req = new Request(`http://localhost/api/context-packs/nonexistent`, {
      method: "PATCH",
      body: JSON.stringify({ issue: "변경" }),
    });
    const res = await PATCH(req, makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/context-packs/[id]", () => {
  beforeEach(async () => {
    await cleanup();
    const team = await db.team.create({ data: { name: RUN } });
    teamId = team.id;
    const pack = await db.contextPack.create({
      data: { issue: "조회 테스트", teamId },
    });
    packId = pack.id;
    vi.mocked(requireAuth).mockResolvedValue(authCtx());
    vi.mocked(assertPackTeamAccess).mockResolvedValue(undefined);
  });

  it("권한이 있으면 팩을 반환해요", async () => {
    const res = await GET(new Request("http://localhost/x"), makeParams(packId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contextPack.id).toBe(packId);
  });

  it("다른 팀의 팩이면 403을 반환해요", async () => {
    vi.mocked(assertPackTeamAccess).mockRejectedValueOnce(
      new AuthError("접근 불가", 403),
    );
    const res = await GET(new Request("http://localhost/x"), makeParams(packId));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/context-packs/[id] — admin 권한", () => {
  beforeEach(async () => {
    await cleanup();
    const team = await db.team.create({ data: { name: RUN } });
    teamId = team.id;
    const pack = await db.contextPack.create({
      data: { issue: "삭제 테스트", teamId },
    });
    packId = pack.id;
    vi.mocked(assertPackTeamAccess).mockResolvedValue(undefined);
  });

  it("admin 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError("이 작업을 수행할 권한이 없어요.", 403),
    );
    const res = await DELETE(new Request("http://localhost/x"), makeParams(packId));
    expect(res.status).toBe(403);
    const fresh = await db.contextPack.findUnique({ where: { id: packId } });
    expect(fresh).not.toBeNull();
  });

  it("admin 권한이면 팩을 삭제해요", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authCtx());
    const res = await DELETE(new Request("http://localhost/x"), makeParams(packId));
    expect(res.status).toBe(200);
    const fresh = await db.contextPack.findUnique({ where: { id: packId } });
    expect(fresh).toBeNull();
  });
});
