/**
 * 계정 삭제/내보내기 — 소유권 가드와 데이터 정리를 실 SQLite로 검증.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  AccountDeletionError,
  collectAccountData,
  deleteAccount,
  findBlockingOwnedTeams,
} from "./account";

const RUN = `account-${Date.now()}`;
let ownerId = "";
let soloTeamId = "";

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: { contains: RUN } } } });
  await db.session.deleteMany({ where: { user: { email: { contains: RUN } } } });
  await db.teamMember.deleteMany({ where: { user: { email: { contains: RUN } } } });
  await db.user.deleteMany({ where: { email: { contains: RUN } } });
  await db.team.deleteMany({ where: { name: { contains: RUN } } });
}

async function makeUser(tag: string) {
  return db.user.create({
    data: { email: `${RUN}-${tag}@t.local`, name: tag, passwordHash: "x" },
  });
}

beforeEach(async () => {
  await cleanup();
  const owner = await makeUser("owner");
  ownerId = owner.id;
  const team = await db.team.create({ data: { name: `${RUN}-solo` } });
  soloTeamId = team.id;
  await db.teamMember.create({ data: { teamId: soloTeamId, userId: ownerId, role: "owner" } });
  await db.contextPack.create({ data: { issue: "내 팩", teamId: soloTeamId, createdById: ownerId } });
});

afterAll(cleanup);

describe("collectAccountData", () => {
  it("사용자·멤버십·팩을 모아 반환해요", async () => {
    const data = await collectAccountData(ownerId);
    expect(data.user.email).toContain(RUN);
    expect(data.memberships).toHaveLength(1);
    expect(data.contextPacks).toHaveLength(1);
    expect(data.contextPacks[0].issue).toBe("내 팩");
  });

  it("없는 사용자면 404 에러", async () => {
    await expect(collectAccountData("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("findBlockingOwnedTeams", () => {
  it("단독 소유 팀은 차단 목록에 없어요", async () => {
    expect(await findBlockingOwnedTeams(ownerId)).toHaveLength(0);
  });

  it("다른 멤버가 있는 소유 팀은 차단돼요", async () => {
    const other = await makeUser("member");
    await db.teamMember.create({ data: { teamId: soloTeamId, userId: other.id, role: "editor" } });
    const blocking = await findBlockingOwnedTeams(ownerId);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].otherMembers).toBe(1);
  });
});

describe("deleteAccount", () => {
  it("단독 소유 계정은 팀·팩까지 삭제돼요", async () => {
    await deleteAccount(ownerId);
    expect(await db.user.findUnique({ where: { id: ownerId } })).toBeNull();
    expect(await db.team.findUnique({ where: { id: soloTeamId } })).toBeNull();
    expect(await db.contextPack.count({ where: { teamId: soloTeamId } })).toBe(0);
  });

  it("공유 팀 소유자는 삭제를 거부해요 (409)", async () => {
    const other = await makeUser("member");
    await db.teamMember.create({ data: { teamId: soloTeamId, userId: other.id, role: "editor" } });
    await expect(deleteAccount(ownerId)).rejects.toBeInstanceOf(AccountDeletionError);
    await expect(deleteAccount(ownerId)).rejects.toMatchObject({ statusCode: 409 });
    // 거부 후 데이터는 그대로
    expect(await db.user.findUnique({ where: { id: ownerId } })).not.toBeNull();
  });

  it("다른 팀 소속(비소유)이면 그 팀 팩은 남고 본인만 빠져요", async () => {
    // ownerId를 다른 팀의 editor로도 추가
    const bossTeam = await db.team.create({ data: { name: `${RUN}-boss` } });
    const boss = await makeUser("boss");
    await db.teamMember.create({ data: { teamId: bossTeam.id, userId: boss.id, role: "owner" } });
    await db.teamMember.create({ data: { teamId: bossTeam.id, userId: ownerId, role: "editor" } });
    await db.contextPack.create({ data: { issue: "보스 팩", teamId: bossTeam.id } });

    await deleteAccount(ownerId);

    // 보스 팀과 그 팩은 남아있어야 해요
    expect(await db.team.findUnique({ where: { id: bossTeam.id } })).not.toBeNull();
    expect(await db.contextPack.count({ where: { teamId: bossTeam.id } })).toBe(1);
    // ownerId의 멤버십은 사라짐
    expect(await db.teamMember.count({ where: { userId: ownerId } })).toBe(0);

    await db.contextPack.deleteMany({ where: { teamId: bossTeam.id } });
    await db.teamMember.deleteMany({ where: { teamId: bossTeam.id } });
    await db.team.delete({ where: { id: bossTeam.id } });
  });
});
