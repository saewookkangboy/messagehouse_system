/**
 * Google Drive에서 문서를 가져와요(import). drive.readonly 스코프가 필요해요
 * (프로덕션에서는 Google 앱 검증 대상). 이 환경엔 자격증명이 없어 실 API는 미검증이에요.
 */
import { extractText } from "@/lib/fileParsing";
import type { ImportableDocument } from "./notionImport";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

// import 대상으로 노출할 MIME (Google 문서 + 텍스트/pdf/docx)
const IMPORTABLE_MIMES = [
  GOOGLE_DOC_MIME,
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function driveFetch(accessToken: string, url: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

/** 가져올 수 있는 Drive 파일 목록을 반환해요. */
export async function listDriveDocuments(
  accessToken: string,
): Promise<ImportableDocument[]> {
  const mimeQuery = IMPORTABLE_MIMES.map((m) => `mimeType='${m}'`).join(" or ");
  const params = new URLSearchParams({
    q: `(${mimeQuery}) and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: "50",
    orderBy: "modifiedTime desc",
  });
  const res = await driveFetch(accessToken, `${DRIVE_API}/files?${params}`);
  if (!res.ok) {
    throw new Error(`Google Drive 문서 목록을 불러오지 못했어요 (${res.status}).`);
  }
  const data = (await res.json()) as {
    files: Array<{ id: string; name: string; mimeType: string }>;
  };
  return data.files.map((f) => ({ externalId: f.id, title: f.name }));
}

/** 파일 본문을 평문으로 가져와요. Google 문서는 text/plain으로 export, 그 외는 다운로드 후 파싱. */
export async function fetchDriveDocumentText(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const metaRes = await driveFetch(
    accessToken,
    `${DRIVE_API}/files/${fileId}?fields=name,mimeType`,
  );
  if (!metaRes.ok) {
    throw new Error(`Google Drive 파일 정보를 불러오지 못했어요 (${metaRes.status}).`);
  }
  const meta = (await metaRes.json()) as { name: string; mimeType: string };

  if (meta.mimeType === GOOGLE_DOC_MIME) {
    const res = await driveFetch(
      accessToken,
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
    );
    if (!res.ok) {
      throw new Error(`Google 문서를 내보내지 못했어요 (${res.status}).`);
    }
    return res.text();
  }

  // 그 외 바이너리(pdf/docx/txt/md)는 다운로드 후 기존 파서로 텍스트 추출
  const res = await driveFetch(accessToken, `${DRIVE_API}/files/${fileId}?alt=media`);
  if (!res.ok) {
    throw new Error(`Google Drive 파일을 다운로드하지 못했어요 (${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return extractText({ filename: meta.name, buffer });
}
