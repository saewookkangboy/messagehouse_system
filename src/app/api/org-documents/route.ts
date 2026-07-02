import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  extractText,
  guessDocFormat,
  DocumentParseError,
  EmptyDocumentError,
  UnsupportedFileTypeError,
} from "@/lib/fileParsing";
import { indexOrgDocument } from "@/lib/rag";
import { AuthError, requireAuth, resolveTeamId } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/api";

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  try {
    const auth = await requireAuth("viewer");
    const teamId = await resolveTeamId(auth);
    const docs = await db.orgDocument.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        filename: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { name: true, email: true } },
      },
    });
    return NextResponse.json({ documents: docs });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("editor");
    const teamId = await resolveTeamId(auth);

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "multipart/form-data가 필요해요." }, { status: 400 });
    }

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const file = formData.get("file");
    if (!title) {
      return NextResponse.json({ error: "문서 제목을 입력해주세요." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일이 없어요." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "파일은 20MB 이하여야 해요." }, { status: 400 });
    }
    if (guessDocFormat(file.name) === "unknown") {
      return NextResponse.json({ error: "지원하지 않는 파일 형식이에요." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText({ filename: file.name, buffer });

    const doc = await db.orgDocument.create({
      data: {
        teamId,
        uploadedById: auth?.user.id,
        title,
        description,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        extractedText: text,
      },
    });

    try {
      await indexOrgDocument(doc.id);
    } catch (indexErr) {
      await db.orgDocument.delete({ where: { id: doc.id } });
      throw indexErr;
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    if (
      err instanceof UnsupportedFileTypeError ||
      err instanceof EmptyDocumentError ||
      err instanceof DocumentParseError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
