/**
 * 가상 인증·초대 E2E — 실제 SQLite에 시나리오를 재현해 검증해요.
 * 실행: npm test -- src/lib/auth/authFlow.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasMinRole } from "@/lib/auth/types";
import {
  acceptTeamInviteForUser,
  acceptTeamInviteWithRegistration,
  createTeamInvite,
  getInvitePreview,
  InviteError,
  revokeTeamInvite,
} from "@/lib/auth/invite";

const RUN = `authflow-${Date.now()}`;
const ownerEmail = `${RUN}-owner@test.local`;
const inviteeEmail = `${RUN}-invitee@test.local`;
const wrongEmail = `${RUN}-wrong@test.local`;

let teamId = "";
let ownerId = "";
let inviteToken = "";

async function cleanup() {
  await db.session.deleteMany({
    where: { user: { email: { contains: RUN } } },
  });
  await db.teamInvite.deleteMany({
    where: { email: { contains: RUN } },
  });
  await db.teamMember.deleteMany({
    where: { user: { email: { contains: RUN } } },
  });
  await db.contextPack.deleteMany({
    where: { team: { members: { some: { user: { email: { contains: RUN } } } } } },
  });
  await db.user.deleteMany({ where: { email: { contains: RUN } } });
  await db.team.deleteMany({ where: { name: { contains: RUN } } });
}

describe("가상 인증·팀 초대 플로우", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await db.user.create({
      data: {
        email: ownerEmail,
        name: "테스트 소유자",
        passwordHash: hashPassword("owner-pass-123"),
      },
    });
    ownerId = owner.id;

    const team = await db.team.create({
      data: {
        name: `${RUN} 팀`,
        members: { create: { userId: owner.id, role: "owner" } },
      },
    });
    teamId = team.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it("1) 소유자 비밀번호 검증", () => {
    const owner = { passwordHash: hashPassword("owner-pass-123") };
    expect(verifyPassword("owner-pass-123", owner.passwordHash)).toBe(true);
    expect(verifyPassword("wrong", owner.passwordHash)).toBe(false);
  });

  it("2) 관리자 권한으로 편집자 초대 링크 생성", async () => {
    const invite = await createTeamInvite({
      teamId,
      email: inviteeEmail,
      role: "editor",
      invitedById: ownerId,
    });
    inviteToken = invite.token;
    expect(invite.invitePath).toBe(`/invite/${invite.token}`);

    const preview = await getInvitePreview(invite.token);
    expect(preview.email).toBe(inviteeEmail);
    expect(preview.teamName).toContain(RUN);
    expect(preview.role).toBe("editor");
  });

  it("3) 초대 링크로 신규 가입 + 팀 합류", async () => {
    const result = await acceptTeamInviteWithRegistration({
      token: inviteToken,
      name: "초대받은 편집자",
      password: "invite-pass-123",
    });

    expect(result.user.email).toBe(inviteeEmail);
    expect(result.team.id).toBe(teamId);
    expect(result.sessionToken.length).toBeGreaterThan(20);

    const member = await db.teamMember.findFirst({
      where: { userId: result.user.id, teamId },
    });
    expect(member?.role).toBe("editor");
    expect(hasMinRole(member!.role, "viewer")).toBe(true);
    expect(hasMinRole(member!.role, "admin")).toBe(false);
  });

  it("4) 사용된 초대 링크 재사용 차단", async () => {
    await expect(
      acceptTeamInviteWithRegistration({
        token: inviteToken,
        name: "다른 사람",
        password: "another-pass-1",
      }),
    ).rejects.toBeInstanceOf(InviteError);
  });

  it("5) 기존 사용자 — 이메일 불일치 시 초대 수락 거부", async () => {
    const other = await db.user.create({
      data: {
        email: wrongEmail,
        name: "다른 사용자",
        passwordHash: hashPassword("wrong-pass-12"),
      },
    });

    const invite = await createTeamInvite({
      teamId,
      email: `${RUN}-match@test.local`,
      role: "viewer",
      invitedById: ownerId,
    });

    await expect(
      acceptTeamInviteForUser({ token: invite.token, userId: other.id }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await revokeTeamInvite(invite.id, teamId);
  });

  it("6) 팀 스코프 — 멤버만 팩 조회 가능 (시뮬레이션)", async () => {
    const pack = await db.contextPack.create({
      data: {
        issue: `${RUN} 테스트 팩`,
        teamId,
        createdById: ownerId,
      },
    });

    const invitee = await db.user.findUnique({ where: { email: inviteeEmail } });
    const inviteeMember = await db.teamMember.findFirst({
      where: { userId: invitee!.id },
    });

    const ownerPack = await db.contextPack.findFirst({
      where: { id: pack.id, teamId: inviteeMember!.teamId },
    });
    expect(ownerPack).not.toBeNull();

    const outsiderTeam = await db.team.create({ data: { name: `${RUN}-외부팀` } });
    const blocked = await db.contextPack.findFirst({
      where: { id: pack.id, teamId: outsiderTeam.id },
    });
    expect(blocked).toBeNull();

    await db.team.delete({ where: { id: outsiderTeam.id } });
  });
});
