import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acceptTeamInviteForUser,
  acceptTeamInviteWithRegistration,
  getInvitePreview,
  InviteError,
} from "@/lib/auth/invite";
import { SESSION_COOKIE } from "@/lib/auth";
import { sessionExpiry } from "@/lib/auth/types";
import { getSession } from "@/lib/auth/session";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  try {
    const preview = await getInvitePreview(token);
    return NextResponse.json({ invite: preview });
  } catch (err) {
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}

const AcceptRegisterSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const session = await getSession();

  try {
    if (session.enabled && session.authenticated) {
      const result = await acceptTeamInviteForUser({
        token,
        userId: session.user.id,
      });
      return NextResponse.json({ accepted: true, ...result });
    }

    const parsed = AcceptRegisterSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "이름과 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const result = await acceptTeamInviteWithRegistration({
      token,
      name: parsed.data.name,
      password: parsed.data.password,
    });

    const response = NextResponse.json({
      accepted: true,
      user: result.user,
      team: result.team,
    });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: sessionExpiry(),
    });
    return response;
  } catch (err) {
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
