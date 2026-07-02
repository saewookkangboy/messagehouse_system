import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";
import { isAuthEnabled } from "@/lib/auth/types";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ExportPackError, exportPackToDestination } from "@/lib/integrations";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  provider: z.enum(["google_drive", "notion", "google"]),
  format: z.enum(["markdown", "json"]).optional(),
});

function resolveProvider(raw: string): IntegrationProvider {
  if (raw === "google") return "google_drive";
  return raw as IntegrationProvider;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "viewer");
    const destinations = await db.exportDestination.findMany({
      where: { contextPackId: id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      destinations: destinations.map((d) => ({
        provider: d.provider,
        url: d.url,
        format: d.format,
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    if (!isAuthEnabled()) {
      return NextResponse.json(
        { error: "외부 저장은 로그인 모드(AUTH_DISABLED=false)에서만 사용할 수 있어요." },
        { status: 400 },
      );
    }
    const auth = await authorizePack(id, "editor");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = BodySchema.parse(await request.json());
    const provider = resolveProvider(body.provider);

    const result = await exportPackToDestination({
      packId: id,
      userId: auth.user.id,
      provider,
      format: body.format,
    });

    return NextResponse.json({
      provider,
      url: result.url,
      externalId: result.externalId,
      updated: result.updated,
    });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof ExportPackError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
