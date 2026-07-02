import { NextResponse } from "next/server";
import { PipelineError, runResearchStep } from "@/lib/pipeline";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "editor");
    const result = await runResearchStep(id);
    return NextResponse.json(result);
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "리서치 중 오류가 발생했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
