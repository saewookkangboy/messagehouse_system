import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  extractText,
  guessDocFormat,
  DocumentParseError,
  EmptyDocumentError,
  UnsupportedFileTypeError,
} from "@/lib/fileParsing";
import { encryptField } from "@/lib/fieldCrypto";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "editor");
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }

  const pack = await db.contextPack.findUnique({
    where: { id },
    include: { files: { select: { sizeBytes: true } } },
  });
  if (!pack) {
    return NextResponse.json({ error: "Context Pack을 찾지 못했어요." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "multipart/form-data 형식의 요청이 필요해요." },
      { status: 400 },
    );
  }

  const incoming = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (incoming.length === 0) {
    return NextResponse.json({ error: "업로드할 파일이 없어요." }, { status: 400 });
  }

  let fileCount = pack.files.length;
  let totalBytes = pack.files.reduce((sum, f) => sum + f.sizeBytes, 0);

  const created = [];
  const errors: Array<{ filename: string; message: string }> = [];

  for (const file of incoming) {
    if (fileCount >= MAX_FILES) {
      errors.push({ filename: file.name, message: "파일 최대 10개를 초과했어요." });
      continue;
    }
    if (totalBytes + file.size > MAX_TOTAL_BYTES) {
      errors.push({ filename: file.name, message: "총 50MB 용량을 초과했어요." });
      continue;
    }
    if (guessDocFormat(file.name) === "unknown") {
      errors.push({ filename: file.name, message: "지원하지 않는 파일 형식이에요." });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractText({ filename: file.name, buffer });
      const record = await db.sourceFile.create({
        data: {
          contextPackId: id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          extractedText: encryptField(text),
        },
      });
      // ponytail: RAG 인덱싱은 analyze 단계에서 — 업로드 응답을 HF cold start(60s+)에 묶지 않음
      created.push(record);
      fileCount += 1;
      totalBytes += file.size;
    } catch (err) {
      const message =
        err instanceof UnsupportedFileTypeError ||
        err instanceof EmptyDocumentError ||
        err instanceof DocumentParseError
          ? err.message
          : "파일을 처리하는 중 문제가 발생했어요.";
      errors.push({ filename: file.name, message });
    }
  }

  return NextResponse.json({ files: created, errors }, { status: created.length ? 201 : 422 });
}
