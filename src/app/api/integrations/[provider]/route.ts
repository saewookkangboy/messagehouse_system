import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth } from "@/lib/auth/session";
import { isAuthEnabled } from "@/lib/auth/types";
import type { IntegrationProvider } from "@/generated/prisma/client";
import {
  deleteConnection,
  updateConnectionMetadata,
} from "@/lib/integrations";

type Params = { params: Promise<{ provider: string }> };

const PROVIDER_MAP: Record<string, IntegrationProvider> = {
  google: "google_drive",
  "google-drive": "google_drive",
  google_drive: "google_drive",
  notion: "notion",
};

const MetadataSchema = z.object({
  defaultFolderId: z.string().optional(),
  notionDatabaseId: z.string().optional(),
  notionParentPageId: z.string().optional(),
  titlePropertyName: z.string().optional(),
});

function resolveProvider(raw: string): IntegrationProvider | null {
  return PROVIDER_MAP[raw] ?? null;
}

export async function PATCH(request: Request, { params }: Params) {
  const { provider: raw } = await params;
  const provider = resolveProvider(raw);
  if (!provider) {
    return NextResponse.json({ error: "지원하지 않는 연동이에요." }, { status: 400 });
  }

  try {
    if (!isAuthEnabled()) {
      return NextResponse.json(
        { error: "외부 연동은 로그인 모드에서만 사용할 수 있어요." },
        { status: 400 },
      );
    }
    const auth = await requireAuth("editor");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = MetadataSchema.parse(await request.json());
    await updateConnectionMetadata(auth.user.id, provider, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { provider: raw } = await params;
  const provider = resolveProvider(raw);
  if (!provider) {
    return NextResponse.json({ error: "지원하지 않는 연동이에요." }, { status: 400 });
  }

  try {
    if (!isAuthEnabled()) {
      return NextResponse.json(
        { error: "외부 연동은 로그인 모드에서만 사용할 수 있어요." },
        { status: 400 },
      );
    }
    const auth = await requireAuth("editor");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    await deleteConnection(auth.user.id, provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
