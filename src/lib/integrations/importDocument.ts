import { db } from "@/lib/db";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { encryptField } from "@/lib/fieldCrypto";
import { indexOrgDocument } from "@/lib/rag";
import { EmptyDocumentError } from "@/lib/fileParsing";
import { getValidAccessToken } from "./connections";
import {
  fetchNotionPageText,
  listNotionDocuments,
  type ImportableDocument,
} from "./notionImport";
import { fetchDriveDocumentText, listDriveDocuments } from "./googleDriveImport";

/** 연동된 서비스에서 가져올 수 있는 문서 목록. */
export async function listImportableDocuments(
  userId: string,
  provider: IntegrationProvider,
): Promise<ImportableDocument[]> {
  const { token } = await getValidAccessToken(userId, provider);
  return provider === "notion"
    ? listNotionDocuments(token)
    : listDriveDocuments(token);
}

/**
 * 외부 문서를 조직 라이브러리(OrgDocument)로 가져와 RAG 인덱싱까지 해요.
 * org-documents 업로드와 동일하게 암호화 저장 + 인덱싱하고, 인덱싱 실패 시 롤백해요.
 */
export async function importDocumentToOrgLibrary(input: {
  userId: string;
  teamId: string;
  provider: IntegrationProvider;
  externalId: string;
  title: string;
}) {
  const { token } = await getValidAccessToken(input.userId, input.provider);
  const text =
    input.provider === "notion"
      ? await fetchNotionPageText(token, input.externalId)
      : await fetchDriveDocumentText(token, input.externalId);

  if (text.trim().length === 0) {
    throw new EmptyDocumentError("가져온 문서에 텍스트가 없어요.");
  }

  const providerLabel = input.provider === "notion" ? "Notion" : "Google Drive";
  const doc = await db.orgDocument.create({
    data: {
      teamId: input.teamId,
      uploadedById: input.userId,
      title: input.title.slice(0, 200) || `${providerLabel} 문서`,
      description: `${providerLabel}에서 가져온 문서`,
      filename: `${input.title.slice(0, 100)}.txt`,
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(text, "utf-8"),
      extractedText: encryptField(text),
    },
  });

  try {
    await indexOrgDocument(doc.id);
  } catch (err) {
    await db.orgDocument.delete({ where: { id: doc.id } });
    throw err;
  }

  return doc;
}
