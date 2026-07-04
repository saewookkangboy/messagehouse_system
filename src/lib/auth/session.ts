import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  hasMinRole,
  isAuthEnabled,
  ACTIVE_TEAM_COOKIE,
  SESSION_COOKIE,
  type AuthContext,
  type SessionUser,
  type TeamRole,
} from "./types";

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export async function getSession(): Promise<SessionUser> {
  if (!isAuthEnabled()) {
    return { enabled: false };
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return { enabled: true, authenticated: false };
  }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return { enabled: true, authenticated: false };
  }

  const memberships = await db.teamMember.findMany({
    where: { userId: session.userId },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) {
    return { enabled: true, authenticated: false };
  }

  // 활성 팀은 쿠키에서 읽되, 반드시 사용자가 실제 멤버인 팀이어야 해요(쿠키는 신뢰 불가).
  // 유효하지 않으면 가장 오래된 멤버십으로 폴백해요.
  const activeTeamId = jar.get(ACTIVE_TEAM_COOKIE)?.value;
  const active =
    memberships.find((m) => m.teamId === activeTeamId) ?? memberships[0];

  return {
    enabled: true,
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    teamId: active.teamId,
    teamName: active.team.name,
    role: active.role,
  };
}

/** 사용자가 속한 모든 팀 (팀 스위처용). */
export async function listUserTeams(
  userId: string,
): Promise<Array<{ id: string; name: string; role: TeamRole }>> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ id: m.teamId, name: m.team.name, role: m.role }));
}

/** 활성 팀 전환 — 사용자가 실제 멤버인 팀만 허용해요. 유효하면 teamId 반환, 아니면 null. */
export async function resolveSwitchableTeam(
  userId: string,
  teamId: string,
): Promise<string | null> {
  const member = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  return member ? teamId : null;
}

export async function requireAuth(minRole: TeamRole = "viewer"): Promise<AuthContext | null> {
  if (!isAuthEnabled()) return null;
  const session = await getSession();
  if (!session.enabled) return null;
  if (!session.authenticated) {
    throw new AuthError("로그인이 필요해요.");
  }
  if (!hasMinRole(session.role, minRole)) {
    throw new AuthError("이 작업을 수행할 권한이 없어요.", 403);
  }
  return session;
}

/** AUTH_DISABLED 데모 모드용 공유 팀 ID */
export async function getDemoTeamId(): Promise<string> {
  const existing = await db.team.findFirst({ where: { name: "__demo__" } });
  if (existing) return existing.id;
  return (await db.team.create({ data: { name: "__demo__" } })).id;
}

export async function resolveTeamId(auth: AuthContext | null): Promise<string> {
  if (auth) return auth.teamId;
  return getDemoTeamId();
}

export function teamScopeWhere(auth: AuthContext | null) {
  if (!auth) return {};
  return { teamId: auth.teamId };
}

export async function assertPackTeamAccess(
  packId: string,
  auth: AuthContext | null,
): Promise<void> {
  if (!auth) return;
  const pack = await db.contextPack.findUnique({
    where: { id: packId },
    select: { teamId: true },
  });
  if (!pack) {
    throw new AuthError("Context Pack을 찾지 못했어요.", 404);
  }
  if (pack.teamId && pack.teamId !== auth.teamId) {
    throw new AuthError("이 Context Pack에 접근할 권한이 없어요.", 403);
  }
}
