import { randomBytes } from "node:crypto";
import type { TeamRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "./password";
import { newSessionToken, sessionExpiry } from "./types";

export class InviteError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "InviteError";
    this.statusCode = statusCode;
  }
}

const INVITE_EXPIRY_DAYS = 7;
const INVITABLE_ROLES = ["admin", "editor", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(role: string): role is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function buildInvitePath(token: string): string {
  return `/invite/${token}`;
}

const ROLE_LABEL: Record<InvitableRole, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "뷰어",
};

export function buildInviteEmail(input: {
  teamName: string;
  role: InvitableRole;
  invitedByName: string;
  inviteUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `${input.invitedByName}님이 "${input.teamName}" 팀에 초대했어요`,
    text: `${input.invitedByName}님이 회원님을 "${input.teamName}" 팀에 ${ROLE_LABEL[input.role]} 권한으로 초대했어요.\n\n아래 링크에서 초대를 수락해주세요 (7일 이내):\n${input.inviteUrl}`,
  };
}

export async function createTeamInvite(input: {
  teamId: string;
  email: string;
  role: InvitableRole;
  invitedById: string;
}): Promise<{ id: string; token: string; expiresAt: Date; invitePath: string }> {
  const email = normalizeEmail(input.email);

  const existingMember = await db.teamMember.findFirst({
    where: { teamId: input.teamId, user: { email } },
  });
  if (existingMember) {
    throw new InviteError("이미 팀에 소속된 이메일이에요.", 409);
  }

  const pending = await db.teamInvite.findFirst({
    where: {
      teamId: input.teamId,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    return {
      id: pending.id,
      token: pending.token,
      expiresAt: pending.expiresAt,
      invitePath: buildInvitePath(pending.token),
    };
  }

  const token = newInviteToken();
  const invite = await db.teamInvite.create({
    data: {
      teamId: input.teamId,
      email,
      role: input.role,
      token,
      invitedById: input.invitedById,
      expiresAt: inviteExpiry(),
    },
  });

  return {
    id: invite.id,
    token: invite.token,
    expiresAt: invite.expiresAt,
    invitePath: buildInvitePath(invite.token),
  };
}

export async function listTeamInvites(teamId: string) {
  return db.teamInvite.findMany({
    where: { teamId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { name: true, email: true } },
    },
  });
}

export async function revokeTeamInvite(inviteId: string, teamId: string): Promise<void> {
  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.teamId !== teamId) {
    throw new InviteError("초대를 찾지 못했어요.", 404);
  }
  if (invite.acceptedAt) {
    throw new InviteError("이미 수락된 초대는 취소할 수 없어요.", 400);
  }
  await db.teamInvite.delete({ where: { id: inviteId } });
}

async function loadValidInvite(token: string) {
  const invite = await db.teamInvite.findUnique({
    where: { token },
    include: { team: true },
  });
  if (!invite) {
    throw new InviteError("유효하지 않은 초대 링크예요.", 404);
  }
  if (invite.acceptedAt) {
    throw new InviteError("이미 사용된 초대 링크예요.", 410);
  }
  if (invite.expiresAt < new Date()) {
    throw new InviteError("만료된 초대 링크예요.", 410);
  }
  return invite;
}

export async function getInvitePreview(token: string) {
  const invite = await loadValidInvite(token);
  return {
    email: invite.email,
    role: invite.role,
    teamName: invite.team.name,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptTeamInviteWithRegistration(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{
  user: { id: string; email: string; name: string };
  team: { id: string; name: string };
  sessionToken: string;
}> {
  const invite = await loadValidInvite(input.token);
  const email = invite.email;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new InviteError(
      "이미 가입된 이메일이에요. 로그인 후 초대를 수락해주세요.",
      409,
    );
  }

  const user = await db.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: hashPassword(input.password),
    },
  });

  await db.teamMember.create({
    data: {
      teamId: invite.teamId,
      userId: user.id,
      role: invite.role,
    },
  });

  await db.teamInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  const sessionToken = newSessionToken();
  await db.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: sessionExpiry(),
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    team: { id: invite.team.id, name: invite.team.name },
    sessionToken,
  };
}

export async function acceptTeamInviteForUser(input: {
  token: string;
  userId: string;
}): Promise<{ team: { id: string; name: string }; role: TeamRole }> {
  const invite = await loadValidInvite(input.token);

  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new InviteError("사용자를 찾지 못했어요.", 404);
  }
  if (normalizeEmail(user.email) !== invite.email) {
    throw new InviteError("초대된 이메일과 로그인 계정이 일치하지 않아요.", 403);
  }

  // 한 계정이 여러 팀에 속할 수 있어요. 같은 팀 재가입만 막아요.
  const existingInThisTeam = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
  });
  if (existingInThisTeam) {
    throw new InviteError("이미 이 팀의 멤버예요.", 409);
  }

  await db.teamMember.create({
    data: {
      teamId: invite.teamId,
      userId: user.id,
      role: invite.role,
    },
  });

  await db.teamInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return {
    team: { id: invite.team.id, name: invite.team.name },
    role: invite.role,
  };
}
