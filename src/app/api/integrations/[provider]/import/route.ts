import { NextResponse } from "next/server";
import { z } from "zod";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth, resolveTeamId } from "@/lib/auth/session";
import { EmptyDocumentError } from "@/lib/fileParsing";
import { importDocumentToOrgLibrary } from "@/lib/integrations/importDocument";

type Params = { params: Promise<{ provider: string }> };

const PROVIDER_MAP: Record<string, IntegrationProvider> = {
  google: "google_drive",
  "google-drive": "google_drive",
  google_drive: "google_drive",
  notion: "notion",
};

const ImportSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1).max(200),
});

/** 선택한 외부 문서를 조직 라이브러리로 가져와요(인덱싱 포함). */
export async function POST(request: Request, { params }: Params) {
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

    const parsed = ImportSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "가져올 문서 정보가 올바르지 않아요." }, { status: 400 });
    }

    const teamId = await resolveTeamId(auth);
    const doc = await importDocumentToOrgLibrary({
      userId: auth.user.id,
      teamId,
      provider,
      externalId: parsed.data.externalId,
      title: parsed.data.title,
    });

    return NextResponse.json(
      { document: { id: doc.id, title: doc.title } },
      { status: 201 },
    );
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof EmptyDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "문서를 가져오지 못했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
