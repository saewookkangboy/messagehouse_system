import { z } from "zod";
import {
  getContextPackPipelineStatus,
  PipelineError,
  runContextPackPipeline,
  runContextPackPipelineStream,
} from "@/lib/pipeline";
import { authErrorResponse, authorizePack } from "@/lib/auth/api";

type Params = { params: Promise<{ id: string }> };

const RunBodySchema = z.object({
  target: z.enum(["analyzed", "researched", "generated"]).default("researched"),
  force: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await authorizePack(id, "viewer");
    const { pack, status } = await getContextPackPipelineStatus(id);
    return Response.json({ contextPack: pack, pipeline: status });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof PipelineError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = RunBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  try {
    await authorizePack(id, "editor");
    const result = await runContextPackPipeline(id, parsed.data);
    const { pack } = await getContextPackPipelineStatus(id);
    return Response.json({
      contextPack: pack,
      pipeline: result.status,
      stepsRun: result.stepsRun,
      analyze: result.analyze,
      research: result.research,
      generate: result.generate,
    });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (err instanceof PipelineError) {
      return Response.json({ error: err.message, step: err.step }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 502 });
  }
}

/** SSE — analyze/research/generate 단계별 진행 이벤트 스트림 */
export async function streamPipeline(
  packId: string,
  options: z.infer<typeof RunBodySchema>,
): Promise<Response> {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        for await (const progress of runContextPackPipelineStream(packId, options)) {
          send(progress.type, progress);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
