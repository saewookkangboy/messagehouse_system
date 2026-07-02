import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { isAuthEnabled } from "@/lib/auth/types";
import {
  exchangeNotionCode,
  integrationRedirectUri,
  OAUTH_STATE_COOKIE,
  upsertConnection,
} from "@/lib/integrations";

export async function GET(request: Request) {
  const settingsUrl = new URL("/settings/integrations", request.url);
  const jar = await cookies();
  const savedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);

  if (!isAuthEnabled()) {
    settingsUrl.searchParams.set("error", "auth_disabled");
    return NextResponse.redirect(settingsUrl);
  }

  const auth = await requireAuth("editor");
  if (!auth) {
    settingsUrl.searchParams.set("error", "login_required");
    return NextResponse.redirect(settingsUrl);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || savedState !== `notion:${state}`) {
    settingsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = integrationRedirectUri(request, "notion");
    const tokens = await exchangeNotionCode(code, redirectUri);
    await upsertConnection({
      userId: auth.user.id,
      provider: "notion",
      accessToken: tokens.accessToken,
      metadata: { workspaceName: tokens.workspaceName },
    });
    settingsUrl.searchParams.set("connected", "notion");
    return NextResponse.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set("error", "notion_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
