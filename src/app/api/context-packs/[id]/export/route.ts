import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  deserializePillars,
  deserializeStringList,
} from "@/lib/contextPackSerialization";
import { toExportClaudePrompt, toExportJson, toExportMarkdown } from "@/lib/exportFormats";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "viewer");
    const pack = await db.contextPack.findUnique({ where: { id } });
    if (!pack) {
      return NextResponse.json({ error: "Context Pack을 찾지 못했어요." }, { status: 404 });
    }
    if (!pack.roofMessage) {
      return NextResponse.json(
        { error: "아직 메시지하우스가 생성되지 않았어요." },
        { status: 400 },
      );
    }

    const format = new URL(request.url).searchParams.get("format") ?? "json";
  const exportable = {
    issue: pack.issue,
    industry: pack.industry,
    version: pack.version,
    roofMessage: pack.roofMessage,
    pillars: deserializePillars(pack.pillars),
    foundation: pack.foundation ?? "",
    objections: deserializeStringList(pack.objections),
    aieoSummary: pack.aieoSummary ?? "",
    riskFlags: deserializeStringList(pack.riskFlags),
    forbiddenTerms: pack.forbiddenTerms ?? "",
    officialTerms: pack.officialTerms ?? "",
  };

    const text =
      format === "markdown"
        ? toExportMarkdown(exportable)
        : format === "claude"
          ? toExportClaudePrompt(exportable)
          : toExportJson(exportable);

    return NextResponse.json({ format, text });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
