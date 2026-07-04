import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, resolveSwitchableTeam, AuthError } from "@/lib/auth/session";
import { ACTIVE_TEAM_COOKIE, sessionExpiry } from "@/lib/auth/types";

const SwitchSchema = z.object({ teamId: z.string().min(1) });

/**
 * 활성 팀 전환. 사용자가 실제 멤버인 팀만 허용해요(아니면 403).
 * 유효하면 활성 팀 쿠키를 설정하고, 이후 세션이 이 팀으로 스코프돼요.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth("viewer");
    if (!auth) {
      return NextResponse.json(
        { error: "데모 모드에서는 팀 전환을 사용할 수 없어요." },
        { status: 400 },
      );
    }

    const parsed = SwitchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "teamId가 필요해요." }, { status: 400 });
    }

    const teamId = await resolveSwitchableTeam(auth.user.id, parsed.data.teamId);
    if (!teamId) {
      return NextResponse.json(
        { error: "소속되지 않은 팀으로는 전환할 수 없어요." },
        { status: 403 },
      );
    }

    const res = NextResponse.json({ ok: true, teamId });
    res.cookies.set(ACTIVE_TEAM_COOKIE, teamId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: sessionExpiry(),
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
