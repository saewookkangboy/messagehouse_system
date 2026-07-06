/**
 * OAuth 인가 URL 빌더 — state·redirect_uri 정확성은 CSRF·리다이렉트 공격 방어의 핵심.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { notionOAuthUrl } from "./notion";
import { googleOAuthUrl } from "./googleDrive";

afterEach(() => vi.unstubAllEnvs());

describe("notionOAuthUrl", () => {
  it("client_id·state·redirect_uri를 정확히 인코딩해요", () => {
    vi.stubEnv("NOTION_CLIENT_ID", "notion-client-123");
    const url = new URL(
      notionOAuthUrl("state-xyz", "https://app.example.com/api/integrations/notion/callback"),
    );
    expect(url.origin + url.pathname).toBe("https://api.notion.com/v1/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("notion-client-123");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/notion/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("NOTION_CLIENT_ID가 없으면 에러", () => {
    vi.stubEnv("NOTION_CLIENT_ID", "");
    expect(() => notionOAuthUrl("s", "https://x/cb")).toThrow(/NOTION_CLIENT_ID/);
  });
});

describe("googleOAuthUrl", () => {
  it("export용 drive.file + import용 drive.readonly 스코프와 offline access를 요청해요", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-456");
    const url = new URL(
      googleOAuthUrl("state-abc", "https://app.example.com/api/integrations/google/callback"),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client-456");
    expect(url.searchParams.get("state")).toBe("state-abc");
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain("https://www.googleapis.com/auth/drive.file");
    expect(scope).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("GOOGLE_CLIENT_ID가 없으면 에러", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(() => googleOAuthUrl("s", "https://x/cb")).toThrow(/GOOGLE_CLIENT_ID/);
  });
});
