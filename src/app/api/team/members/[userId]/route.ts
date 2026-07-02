import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireAuth } from "@/lib/auth/session";

const PatchRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("admin");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const { userId } = await params;
    const parsed = PatchRoleSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "역할 형식이 올바르지 않아요." }, { status: 400 });
    }

    const member = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: auth.teamId, userId } },
    });
    if (!member) {
      return NextResponse.json({ error: "팀원을 찾지 못했어요." }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json({ error: "팀 소유자의 역할은 변경할 수 없어요." }, { status: 400 });
    }

    const updated = await db.teamMember.update({
      where: { id: member.id },
      data: { role: parsed.data.role },
    });
    return NextResponse.json({ member: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("admin");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const { userId } = await params;
    if (userId === auth.user.id) {
      return NextResponse.json({ error: "자기 자신은 팀에서 제거할 수 없어요." }, { status: 400 });
    }

    const member = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: auth.teamId, userId } },
    });
    if (!member) {
      return NextResponse.json({ error: "팀원을 찾지 못했어요." }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json({ error: "팀 소유자는 제거할 수 없어요." }, { status: 400 });
    }

    await db.teamMember.delete({ where: { id: member.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
