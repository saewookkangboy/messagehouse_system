/**
 * 세션·권한 판정 로직 — 실 SQLite로 세션을 시딩하고 next/headers 쿠키를 모킹해요.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

let cookieToken: string | undefined;
let activeTeamCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "mh_session" && cookieToken) return { value: cookieToken };
      if (name === "mh_active_team" && activeTeamCookie) return { value: activeTeamCookie };
      return undefined;
    },
  }),
}));

const {
  getSession,
  requireAuth,
  assertPackTeamAccess,
  listUserTeams,
  resolveSwitchableTeam,
  AuthError,
} = await import("./session");

const RUN = `session-${Date.now()}`;
let userId = "";
let teamId = "";
let otherTeamId = "";

async function cleanup() {
  await db.session.deleteMany({ where: { user: { email: { contains: RUN } } } });
  await db.contextPack.deleteMany({ where: { team: { name: { contains: RUN } } } });
  await db.teamMember.deleteMany({ where: { user: { email: { contains: RUN } } } });
  await db.user.deleteMany({ where: { email: { contains: RUN } } });
  await db.team.deleteMany({ where: { name: { contains: RUN } } });
}

async function makeSession(role: "owner" | "admin" | "editor" | "viewer", expiresAt: Date) {
  const token = `${RUN}-tok-${Math.random().toString(36).slice(2)}`;
  await db.session.create({ data: { userId, token, expiresAt } });
  await db.teamMember.updateMany({ where: { userId, teamId }, data: { role } });
  return token;
}

beforeEach(async () => {
  vi.stubEnv("AUTH_DISABLED", "false");
  await cleanup();
  const team = await db.team.create({ data: { name: `${RUN}-team` } });
  teamId = team.id;
  otherTeamId = (await db.team.create({ data: { name: `${RUN}-other` } })).id;
  const user = await db.user.create({
    data: { email: `${RUN}@t.local`, name: "테스터", passwordHash: "x" },
  });
  userId = user.id;
  await db.teamMember.create({ data: { teamId, userId, role: "editor" } });
  cookieToken = undefined;
  activeTeamCookie = undefined;
});

afterEach(() => vi.unstubAllEnvs());
afterAll(cleanup);

describe("getSession", () => {
  it("토큰이 없으면 미인증", async () => {
    const s = await getSession();
    expect(s).toEqual({ enabled: true, authenticated: false });
  });

  it("유효한 세션 + 멤버십이면 인증 + 역할 반환", async () => {
    cookieToken = await makeSession("editor", new Date(Date.now() + 60_000));
    const s = await getSession();
    expect(s.enabled).toBe(true);
    if (!("authenticated" in s) || !s.authenticated) throw new Error("인증 실패");
    expect(s.role).toBe("editor");
    expect(s.teamId).toBe(teamId);
  });

  it("만료된 세션은 미인증 처리하고 삭제해요", async () => {
    cookieToken = await makeSession("editor", new Date(Date.now() - 1000));
    const s = await getSession();
    expect(s).toEqual({ enabled: true, authenticated: false });
    const remaining = await db.session.findFirst({ where: { token: cookieToken } });
    expect(remaining).toBeNull();
  });

  it("멤버십이 없으면 미인증", async () => {
    await db.teamMember.deleteMany({ where: { userId } });
    cookieToken = await makeSession("editor", new Date(Date.now() + 60_000));
    // makeSession의 updateMany는 멤버십 없어서 no-op — 세션만 존재
    const s = await getSession();
    expect(s.enabled && "authenticated" in s && s.authenticated).toBe(false);
  });

  it("AUTH_DISABLED=true면 enabled:false", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");
    const s = await getSession();
    expect(s).toEqual({ enabled: false });
  });
});

describe("requireAuth", () => {
  it("미인증이면 401 AuthError", async () => {
    await expect(requireAuth("viewer")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("역할이 부족하면 403 AuthError", async () => {
    cookieToken = await makeSession("viewer", new Date(Date.now() + 60_000));
    await expect(requireAuth("admin")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("역할을 충족하면 컨텍스트 반환", async () => {
    cookieToken = await makeSession("admin", new Date(Date.now() + 60_000));
    const auth = await requireAuth("editor");
    expect(auth?.role).toBe("admin");
  });

  it("AUTH_DISABLED=true면 null 반환 (데모 모드)", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(await requireAuth("admin")).toBeNull();
  });
});

describe("assertPackTeamAccess", () => {
  const auth = () => ({
    user: { id: userId, email: `${RUN}@t.local`, name: "테스터" },
    teamId,
    teamName: RUN,
    role: "editor" as const,
  });

  it("같은 팀 팩이면 통과", async () => {
    const pack = await db.contextPack.create({ data: { issue: "내팩", teamId } });
    await expect(assertPackTeamAccess(pack.id, auth())).resolves.toBeUndefined();
  });

  it("다른 팀 팩이면 403", async () => {
    const pack = await db.contextPack.create({ data: { issue: "남팩", teamId: otherTeamId } });
    await expect(assertPackTeamAccess(pack.id, auth())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("존재하지 않는 팩이면 404", async () => {
    await expect(assertPackTeamAccess("nope", auth())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("auth가 null(데모)이면 검사 생략", async () => {
    await expect(assertPackTeamAccess("nope", null)).resolves.toBeUndefined();
  });

  it("AuthError 인스턴스로 던져요", async () => {
    const pack = await db.contextPack.create({ data: { issue: "남팩2", teamId: otherTeamId } });
    await expect(assertPackTeamAccess(pack.id, auth())).rejects.toBeInstanceOf(AuthError);
  });
});

describe("멀티팀 — 활성 팀 해석 (보안 핵심)", () => {
  async function joinOtherTeam() {
    // 사용자를 otherTeamId에도 admin으로 가입시켜요 (멀티팀)
    await db.teamMember.create({ data: { teamId: otherTeamId, userId, role: "admin" } });
  }

  it("활성 팀 쿠키가 없으면 가장 오래된 멤버십으로 폴백해요", async () => {
    await joinOtherTeam();
    cookieToken = await makeSession("editor", new Date(Date.now() + 60_000));
    const s = await getSession();
    if (!("authenticated" in s) || !s.authenticated) throw new Error("인증 실패");
    expect(s.teamId).toBe(teamId); // 첫 팀
  });

  it("멤버인 팀을 가리키는 쿠키는 그 팀으로 스코프돼요", async () => {
    await joinOtherTeam();
    cookieToken = await makeSession("editor", new Date(Date.now() + 60_000));
    activeTeamCookie = otherTeamId;
    const s = await getSession();
    if (!("authenticated" in s) || !s.authenticated) throw new Error("인증 실패");
    expect(s.teamId).toBe(otherTeamId);
    expect(s.role).toBe("admin"); // 그 팀에서의 역할
  });

  it("멤버가 아닌 팀을 가리키는 쿠키는 무시하고 폴백해요 (쿠키 위조 방어)", async () => {
    // otherTeamId에 가입하지 않은 상태에서 그 팀으로 쿠키 위조
    cookieToken = await makeSession("editor", new Date(Date.now() + 60_000));
    activeTeamCookie = otherTeamId;
    const s = await getSession();
    if (!("authenticated" in s) || !s.authenticated) throw new Error("인증 실패");
    expect(s.teamId).toBe(teamId); // 위조 무시, 실제 멤버 팀으로 폴백
  });
});

describe("listUserTeams / resolveSwitchableTeam", () => {
  it("사용자가 속한 모든 팀을 반환해요", async () => {
    await db.teamMember.create({ data: { teamId: otherTeamId, userId, role: "admin" } });
    const teams = await listUserTeams(userId);
    expect(teams.map((t) => t.id).sort()).toEqual([teamId, otherTeamId].sort());
  });

  it("멤버인 팀은 전환 가능(teamId 반환)", async () => {
    expect(await resolveSwitchableTeam(userId, teamId)).toBe(teamId);
  });

  it("멤버가 아닌 팀은 전환 불가(null)", async () => {
    expect(await resolveSwitchableTeam(userId, otherTeamId)).toBeNull();
  });
});
