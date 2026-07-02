import { NextResponse } from "next/server";
import { PipelineError, runGenerateStep } from "@/lib/pipeline";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "editor");
    const result = await runGenerateStep(id);
    return NextResponse.json(result);
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
