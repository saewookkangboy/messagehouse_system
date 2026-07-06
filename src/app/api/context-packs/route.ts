import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assertPackTeamAccess,
  requireAuth,
  teamScopeWhere,
} from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/api";

function handleAuthError(err: unknown) {
  const res = authErrorResponse(err);
  if (res) return res;
  throw err;
}

export async function GET() {
  try {
    const auth = await requireAuth("viewer");
    const packs = await db.contextPack.findMany({
      where: teamScopeWhere(auth),
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { files: true } } },
    });
    return NextResponse.json({ contextPacks: packs });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("editor");
    const body = await request.json().catch(() => ({}));
    const issue = typeof body.issue === "string" && body.issue.trim() ? body.issue.trim() : undefined;
    const industry =
      typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : undefined;
    const purpose =
      typeof body.purpose === "string" && body.purpose.trim() ? body.purpose.trim() : undefined;
    const targetAudience =
      typeof body.targetAudience === "string" && body.targetAudience.trim()
        ? body.targetAudience.trim()
        : undefined;

    const pack = await db.contextPack.create({
      data: {
        issue,
        industry,
        purpose,
        targetAudience,
        teamId: auth?.teamId,
        createdById: auth?.user.id,
      },
    });
    return NextResponse.json({ contextPack: pack }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
