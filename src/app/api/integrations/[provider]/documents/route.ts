import { NextResponse } from "next/server";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth } from "@/lib/auth/session";
import { listImportableDocuments } from "@/lib/integrations/importDocument";

type Params = { params: Promise<{ provider: string }> };

const PROVIDER_MAP: Record<string, IntegrationProvider> = {
  google: "google_drive",
  "google-drive": "google_drive",
  google_drive: "google_drive",
  notion: "notion",
};

/** 연동된 서비스에서 가져올 수 있는 문서 목록. */
export async function GET(_request: Request, { params }: Params) {
  const { provider: raw } = await params;
  const provider = PROVIDER_MAP[raw];
  if (!provider) {
    return NextResponse.json({ error: "지원하지 않는 연동이에요." }, { status: 400 });
  }

  try {
    const auth = await requireAuth("editor");
    if (!auth) {
      return NextResponse.json(
        { error: "데모 모드에서는 외부 가져오기를 사용할 수 없어요." },
        { status: 400 },
      );
    }
    const documents = await listImportableDocuments(auth.user.id, provider);
    return NextResponse.json({ documents });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    const message = err instanceof Error ? err.message : "문서 목록을 불러오지 못했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
