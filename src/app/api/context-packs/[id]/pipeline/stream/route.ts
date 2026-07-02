import { z } from "zod";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";
import { streamPipeline } from "../route";

type Params = { params: Promise<{ id: string }> };

const QuerySchema = z.object({
  target: z.enum(["analyzed", "researched", "generated"]).default("researched"),
  force: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    target: url.searchParams.get("target") ?? "researched",
    force: url.searchParams.get("force") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  try {
    await authorizePack(id, "editor");
    return streamPipeline(id, parsed.data);
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
