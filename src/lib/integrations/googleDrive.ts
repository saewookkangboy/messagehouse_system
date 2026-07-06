import type { DestinationExportInput, ExportDestinationResult } from "./schema";
import { safeExportFilename } from "./schema";
import { toExportJson, toExportMarkdown } from "@/lib/exportFormats";

const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

function fileContent(input: DestinationExportInput): { mime: string; body: string; name: string } {
  if (input.format === "json") {
    return {
      mime: "application/json",
      body: toExportJson(input.pack),
      name: safeExportFilename(input.pack.issue, input.pack.version, "json"),
    };
  }
  return {
    mime: "text/markdown",
    body: toExportMarkdown(input.pack),
    name: safeExportFilename(input.pack.issue, input.pack.version, "md"),
  };
}

export async function exportToGoogleDrive(
  accessToken: string,
  input: DestinationExportInput,
): Promise<ExportDestinationResult> {
  const { mime, body, name } = fileContent(input);
  const folderId = input.metadata.defaultFolderId?.trim();

  if (input.existingExternalId) {
    const res = await fetch(
      `${DRIVE_UPLOAD}/${input.existingExternalId}?uploadType=media&supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mime,
        },
        body,
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Drive 파일 업데이트 실패: ${err.slice(0, 200)}`);
    }
    const file = (await res.json()) as { id: string; webViewLink?: string };
    return {
      externalId: file.id,
      url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      updated: true,
    };
  }

  const metadata: Record<string, unknown> = { name, mimeType: mime };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "messagehouse_export_boundary";
  const multipart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mime}`,
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipart,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive 업로드 실패: ${err.slice(0, 200)}`);
  }

  const file = (await res.json()) as { id: string; webViewLink?: string };
  return {
    externalId: file.id,
    url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    updated: false,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET가 설정되지 않았어요.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Google 토큰 갱신에 실패했어요. 다시 연결해주세요.");
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export function googleOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID가 설정되지 않았어요.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // drive.file: 앱이 만든 파일(export용) · drive.readonly: 사용자 파일 읽기(import용)
    // drive.readonly는 Google 제한 스코프라 프로덕션 배포 시 앱 검증이 필요해요.
    scope:
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET가 설정되지 않았어요.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error("Google OAuth 인증에 실패했어요.");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
