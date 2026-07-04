/**
 * 팀원 역할 변경/제거 라우트 — admin 강제 + owner 보호.
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
const { PATCH, DELETE } = await import("./route");

const RUN = `route-member-${Date.now()}`;
let teamId = "";
let ownerId = "";
let editorId = "";

function makeParams(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

async function cleanup() {
  await db.teamMember.deleteMany({ where: { team: { name: RUN } } });
  await db.user.deleteMany({ where: { email: { contains: RUN } } });
  await db.team.deleteMany({ where: { name: RUN } });
}

async function seed() {
  await cleanup();
  const team = await db.team.create({ data: { name: RUN } });
  teamId = team.id;
  const owner = await db.user.create({
    data: { email: `${RUN}-owner@t.local`, name: "소유자", passwordHash: "x" },
  });
  ownerId = owner.id;
  const editor = await db.user.create({
    data: { email: `${RUN}-editor@t.local`, name: "편집자", passwordHash: "x" },
  });
  editorId = editor.id;
  await db.teamMember.create({ data: { teamId, userId: ownerId, role: "owner" } });
  await db.teamMember.create({ data: { teamId, userId: editorId, role: "editor" } });
}

const adminCtx = () => ({
  user: { id: ownerId, email: `${RUN}-owner@t.local`, name: "소유자" },
  teamId,
  teamName: RUN,
  role: "admin" as const,
});

describe("PATCH /api/team/members/[userId]", () => {
  beforeEach(seed);
  afterAll(cleanup);

  it("admin 미만 권한이면 403을 반환해요", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("권한 없음", 403));
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ role: "viewer" }),
    });
    const res = await PATCH(req, makeParams(editorId));
    expect(res.status).toBe(403);
  });

  it("팀 소유자의 역할은 변경할 수 없어요 (400)", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminCtx());
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ role: "viewer" }),
    });
    const res = await PATCH(req, makeParams(ownerId));
    expect(res.status).toBe(400);
  });

  it("일반 팀원 역할은 변경돼요", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminCtx());
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ role: "viewer" }),
    });
    const res = await PATCH(req, makeParams(editorId));
    expect(res.status).toBe(200);
    const member = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: editorId } },
    });
    expect(member?.role).toBe("viewer");
  });
});

describe("DELETE /api/team/members/[userId]", () => {
  beforeEach(seed);
  afterAll(cleanup);

  it("자기 자신은 제거할 수 없어요 (400)", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminCtx());
    const res = await DELETE(new Request("http://localhost/x"), makeParams(ownerId));
    expect(res.status).toBe(400);
  });

  it("팀 소유자는 제거할 수 없어요 (400)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ ...adminCtx(), user: { id: editorId, email: "x", name: "x" } });
    const res = await DELETE(new Request("http://localhost/x"), makeParams(ownerId));
    expect(res.status).toBe(400);
  });

  it("일반 팀원은 제거돼요", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminCtx());
    const res = await DELETE(new Request("http://localhost/x"), makeParams(editorId));
    expect(res.status).toBe(200);
    const member = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: editorId } },
    });
    expect(member).toBeNull();
  });
});
