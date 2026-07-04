import { db } from "@/lib/db";

export class AccountDeletionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AccountDeletionError";
    this.statusCode = statusCode;
  }
}

/**
 * 사용자 데이터를 JSON으로 모아 반환해요 (GDPR 데이터 이동권).
 * 삭제 전 내보내기 용도로도 씁니다.
 */
export async function collectAccountData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    throw new AccountDeletionError("사용자를 찾지 못했어요.", 404);
  }

  const memberships = await db.teamMember.findMany({
    where: { userId },
    select: { role: true, createdAt: true, team: { select: { id: true, name: true } } },
  });

  const teamIds = memberships.map((m) => m.team.id);
  const contextPacks = await db.contextPack.findMany({
    where: { teamId: { in: teamIds } },
    select: {
      id: true,
      issue: true,
      industry: true,
      status: true,
      roofMessage: true,
      createdAt: true,
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    user,
    memberships: memberships.map((m) => ({
      teamId: m.team.id,
      teamName: m.team.name,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    contextPacks,
  };
}

/**
 * 소유 팀 중 다른 멤버가 있는 팀 목록. 있으면 삭제를 막기 위한 판정에 써요.
 */
export async function findBlockingOwnedTeams(userId: string) {
  const ownedMemberships = await db.teamMember.findMany({
    where: { userId, role: "owner" },
    select: { teamId: true, team: { select: { name: true } } },
  });

  const blocking: { teamId: string; teamName: string; otherMembers: number }[] = [];
  for (const m of ownedMemberships) {
    const otherMembers = await db.teamMember.count({
      where: { teamId: m.teamId, userId: { not: userId } },
    });
    if (otherMembers > 0) {
      blocking.push({ teamId: m.teamId, teamName: m.team.name, otherMembers });
    }
  }
  return blocking;
}

/**
 * 계정과 관련 데이터를 삭제해요.
 * - 다른 멤버가 있는 소유 팀이 있으면 거부해요 (소유권 이양 먼저).
 * - 단독 소유 팀은 팩까지 명시적으로 삭제해요 (팀 삭제는 팩을 SetNull로 고아화하므로).
 * - 다른 팀의 멤버로서 만든 팩은 그 팀 소유이므로 남겨요 (createdBy만 SetNull).
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AccountDeletionError("사용자를 찾지 못했어요.", 404);
  }

  const blocking = await findBlockingOwnedTeams(userId);
  if (blocking.length > 0) {
    const names = blocking.map((b) => `"${b.teamName}"`).join(", ");
    throw new AccountDeletionError(
      `${names} 팀에 다른 팀원이 있어요. 먼저 소유권을 이양하거나 팀원을 제거한 뒤 다시 시도해주세요.`,
      409,
    );
  }

  const ownedTeamIds = (
    await db.teamMember.findMany({ where: { userId, role: "owner" }, select: { teamId: true } })
  ).map((m) => m.teamId);

  await db.$transaction(async (tx) => {
    if (ownedTeamIds.length > 0) {
      // 팩은 팀 SetNull로 삭제되지 않으므로 명시 삭제 (SourceFile·DocumentChunk는 Cascade)
      await tx.contextPack.deleteMany({ where: { teamId: { in: ownedTeamIds } } });
      // 팀 삭제 시 OrgDocument·TeamMember·TeamInvite는 Cascade
      await tx.team.deleteMany({ where: { id: { in: ownedTeamIds } } });
    }
    // User 삭제 시 Session·남은 TeamMember·IntegrationConnection·보낸 초대는 Cascade
    await tx.user.delete({ where: { id: userId } });
  });
}
