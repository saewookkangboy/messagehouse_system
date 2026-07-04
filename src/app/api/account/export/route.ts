import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { AccountDeletionError, collectAccountData } from "@/lib/account";

/**
 * 계정 데이터 내보내기 (GDPR 데이터 이동권). 사용자·멤버십·팩을 JSON으로 다운로드해요.
 */
export async function GET() {
  try {
    const auth = await requireAuth("viewer");
    if (!auth) {
      return NextResponse.json(
        { error: "데모 모드에서는 데이터 내보내기를 사용할 수 없어요." },
        { status: 400 },
      );
    }

    const data = await collectAccountData(auth.user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="messagehouse-account-${auth.user.id}.json"`,
      },
    });
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
