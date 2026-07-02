import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireAuth, resolveTeamId } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("admin");
    const teamId = await resolveTeamId(auth);
    const { id } = await params;
    const doc = await db.orgDocument.findUnique({ where: { id } });
    if (!doc || doc.teamId !== teamId) {
      return NextResponse.json({ error: "문서를 찾지 못했어요." }, { status: 404 });
    }

    await db.orgDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
