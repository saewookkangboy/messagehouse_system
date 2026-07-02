import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { PillarSchema } from "@/lib/ai/schema";
import {
  canConfirm,
  serializePillars,
  serializeStringList,
} from "@/lib/contextPackSerialization";
import {
  buildContextPackPatchData,
  StatusTransitionError,
} from "@/lib/contextPackStatus";
import {
  assertPackTeamAccess,
  requireAuth,
} from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

function handleAuthError(err: unknown) {
  const res = authErrorResponse(err);
  if (res) return res;
  throw err;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("viewer");
    const { id } = await params;
    await assertPackTeamAccess(id, auth);
    const pack = await db.contextPack.findUnique({
      where: { id },
      include: { files: { orderBy: { createdAt: "asc" } } },
    });
    if (!pack) {
      return NextResponse.json({ error: "Context Pack을 찾지 못했어요." }, { status: 404 });
    }
    return NextResponse.json({ contextPack: pack });
  } catch (err) {
    return handleAuthError(err);
  }
}

const PatchBodySchema = z.object({
  issue: z.string().min(1).optional(),
  industry: z.string().nullable().optional(),
  roofMessage: z.string().optional(),
  pillars: z.array(PillarSchema).optional(),
  foundation: z.string().optional(),
  objections: z.array(z.string()).optional(),
  aieoSummary: z.string().optional(),
  riskFlags: z.array(z.string()).optional(),
  forbiddenTerms: z.string().optional(),
  officialTerms: z.string().optional(),
  gateMessageReviewed: z.boolean().optional(),
  gateNoConfidential: z.boolean().optional(),
  gateNumbersVerified: z.boolean().optional(),
  status: z.enum(["draft", "review", "confirmed"]).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("editor");
    const { id } = await params;
    await assertPackTeamAccess(id, auth);
  const existing = await db.contextPack.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Context Pack을 찾지 못했어요." }, { status: 404 });
  }

  const parsed = PatchBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않아요.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const { data: patchData, effectiveStatus } = buildContextPackPatchData({
      existing,
      body,
      serialized: {
        ...(body.pillars !== undefined
          ? { pillars: serializePillars(body.pillars) }
          : {}),
        ...(body.objections !== undefined
          ? { objections: serializeStringList(body.objections) }
          : {}),
        ...(body.riskFlags !== undefined
          ? { riskFlags: serializeStringList(body.riskFlags) }
          : {}),
      },
    });

    // PRD H-구간: confirmed 전환 시 3개 게이트 + roofMessage 서버 검증
    if (effectiveStatus === "confirmed") {
      const mergedGates = {
        gateMessageReviewed:
          (patchData.gateMessageReviewed as boolean | undefined) ??
          existing.gateMessageReviewed,
        gateNoConfidential:
          (patchData.gateNoConfidential as boolean | undefined) ??
          existing.gateNoConfidential,
        gateNumbersVerified:
          (patchData.gateNumbersVerified as boolean | undefined) ??
          existing.gateNumbersVerified,
      };
      if (!canConfirm(mergedGates)) {
        return NextResponse.json(
          {
            error:
              "확정하려면 3개 확인 항목(최종 메시지 확인, 미공개 정보 없음, 수치 대조)을 모두 체크해야 해요.",
          },
          { status: 400 },
        );
      }
      const roofMessage =
        (patchData.roofMessage as string | undefined) ?? existing.roofMessage;
      if (!roofMessage) {
        return NextResponse.json(
          { error: "메시지하우스 초안이 아직 생성되지 않았어요. 먼저 생성해주세요." },
          { status: 400 },
        );
      }
    }

    const pack = await db.contextPack.update({
      where: { id },
      data: patchData,
    });

    return NextResponse.json({ contextPack: pack });
  } catch (err) {
    if (err instanceof StatusTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
} catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireAuth("admin");
    const { id } = await params;
    await assertPackTeamAccess(id, auth);
  const existing = await db.contextPack.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Context Pack을 찾지 못했어요." }, { status: 404 });
  }
  await db.contextPack.delete({ where: { id } });
  return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
