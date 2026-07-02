import { randomBytes } from "node:crypto";

export const OAUTH_STATE_COOKIE = "mh_oauth_state";

export function newOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function integrationRedirectUri(request: Request, provider: string): string {
  const url = new URL(request.url);
  url.pathname = `/api/integrations/${provider}/callback`;
  url.search = "";
  return url.origin + url.pathname;
}

export function integrationsConfigured(): {
  google: boolean;
  notion: boolean;
} {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    notion: Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
  };
}
