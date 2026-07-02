import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireAuth } from "@/lib/auth/session";

export async function GET() {
  try {
    const auth = await requireAuth("viewer");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const members = await db.teamMember.findMany({
      where: { teamId: auth.teamId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      team: { id: auth.teamId, name: auth.teamName },
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
