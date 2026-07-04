import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { AccountDeletionError, deleteAccount } from "@/lib/account";

/**
 * 계정 삭제 (GDPR 삭제권). 단독 소유 팀·팩까지 함께 삭제하고 세션 쿠키를 비워요.
 * 다른 멤버가 있는 소유 팀이 있으면 409로 거부해요 (소유권 이양 먼저).
 */
export async function DELETE() {
  try {
    const auth = await requireAuth("viewer");
    if (!auth) {
      return NextResponse.json(
        { error: "데모 모드에서는 계정 삭제를 사용할 수 없어요." },
        { status: 400 },
      );
    }

    await deleteAccount(auth.user.id);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof AccountDeletionError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
