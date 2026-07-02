import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id, fileId } = await params;
  try {
    await authorizePack(id, "editor");
    const file = await db.sourceFile.findUnique({ where: { id: fileId } });
    if (!file || file.contextPackId !== id) {
      return NextResponse.json({ error: "파일을 찾지 못했어요." }, { status: 404 });
    }
    await db.sourceFile.delete({ where: { id: fileId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
