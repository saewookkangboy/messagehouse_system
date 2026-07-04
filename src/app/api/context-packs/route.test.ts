/**
 * Context Pack 목록/생성 라우트 — 인증 강제 + 팀 스코프 격리.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return { ...actual, requireAuth: vi.fn() };
});

const { requireAuth } = await import("@/lib/auth/session");
const { GET, POST } = await import("./route");

const RUN = `route-list-${Date.now()}`;
let teamA = "";
let teamB = "";

let userId = "";

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: { contains: RUN } } } });
  await db.team.deleteMany({ where: { name: { contains: RUN } } });
  await db.user.deleteMany({ where: { email: { contains: RUN } } });
}

const ctx = (teamId: string) => ({
  user: { id: userId, email: `${RUN}@t.local`, name: "t" },
  teamId,
  teamName: RUN,
  role: "editor" as const,
});

describe("GET /api/context-packs — 팀 스코프", () => {
  beforeEach(async () => {
    await cleanup();
    teamA = (await db.team.create({ data: { name: `${RUN}-A` } })).id;
    teamB = (await db.team.create({ data: { name: `${RUN}-B` } })).id;
    await db.contextPack.create({ data: { issue: "A팀 팩", teamId: teamA } });
    await db.contextPack.create({ data: { issue: "B팀 팩", teamId: teamB } });
  });
  afterAll(cleanup);

  it("로그인하지 않으면 401을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("자기 팀 팩만 조회돼요 (다른 팀 격리)", async () => {
    vi.mocked(requireAuth).mockResolvedValue(ctx(teamA));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const issues = body.contextPacks.map((p: { issue: string }) => p.issue);
    expect(issues).toContain("A팀 팩");
    expect(issues).not.toContain("B팀 팩");
  });
});

describe("POST /api/context-packs", () => {
  beforeEach(async () => {
    await cleanup();
    teamA = (await db.team.create({ data: { name: `${RUN}-A` } })).id;
    userId = (
      await db.user.create({
        data: { email: `${RUN}@t.local`, name: "t", passwordHash: "x" },
      })
    ).id;
  });
  afterAll(cleanup);

  it("로그인하지 않으면 401을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("로그인이 필요해요."));
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("생성 시 요청자의 팀·유저가 귀속돼요", async () => {
    vi.mocked(requireAuth).mockResolvedValue(ctx(teamA));
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ issue: "새 팩" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.contextPack.teamId).toBe(teamA);
    expect(body.contextPack.createdById).toBe(userId);
  });
});
