import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth } from "@/lib/auth/session";
import { isAuthEnabled } from "@/lib/auth/types";
import {
  googleOAuthUrl,
  newOAuthState,
  OAUTH_STATE_COOKIE,
  integrationRedirectUri,
  integrationsConfigured,
} from "@/lib/integrations";

export async function GET(request: Request) {
  try {
    if (!isAuthEnabled()) {
      return NextResponse.json(
        { error: "외부 연동은 로그인 모드(AUTH_DISABLED=false)에서만 사용할 수 있어요." },
        { status: 400 },
      );
    }
    if (!integrationsConfigured().google) {
      return NextResponse.json(
        { error: "Google OAuth 환경변수가 설정되지 않았어요." },
        { status: 503 },
      );
    }
    const auth = await requireAuth("editor");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const state = newOAuthState();
    const jar = await cookies();
    jar.set(OAUTH_STATE_COOKIE, `google:${state}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    const redirectUri = integrationRedirectUri(request, "google");
    const url = googleOAuthUrl(state, redirectUri);
    return NextResponse.redirect(url);
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
