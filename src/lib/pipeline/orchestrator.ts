import { db } from "@/lib/db";
import type {
  PackWithFiles,
  PipelineProgressEvent,
  PipelineRunResult,
  PipelineRunTarget,
  PipelineStatus,
  PipelineStep,
} from "./schema";
import { PipelineError } from "./schema";
import {
  clearPipelineError,
  clearPipelineRunning,
  setPipelineError,
  setPipelineRunning,
} from "./persistence";
import { derivePipelineStatus, targetSteps } from "./status";
import { runAnalyzeStep, runGenerateStep, runResearchStep } from "./steps";

async function loadPack(packId: string): Promise<PackWithFiles> {
  const pack = await db.contextPack.findUnique({
    where: { id: packId },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  if (!pack) {
    throw new PipelineError("Context Pack을 찾지 못했어요.", "upload", 404);
  }
  return pack;
}

function needsStep(
  pack: PackWithFiles,
  step: PipelineStep,
  force: boolean,
): boolean {
  switch (step) {
    case "analyze":
      return pack.files.some((f) => !f.analyzedAt);
    case "research":
      return force || (pack.researchResult === null && pack.researchStatus !== "completed");
    case "generate":
      return force || pack.roofMessage === null;
    default:
      return false;
  }
}

async function runStep(
  packId: string,
  step: PipelineStep,
  result: PipelineRunResult,
): Promise<void> {
  await setPipelineRunning(packId, step);
  switch (step) {
    case "analyze": {
      result.analyze = await runAnalyzeStep(packId);
      result.stepsRun.push("analyze");
      const pack = await loadPack(packId);
      if (pack.files.every((f) => f.analyzedAt)) {
        await db.contextPack.update({
          where: { id: packId },
          data: { analyzedAt: new Date() },
        });
      }
      break;
    }
    case "research": {
      result.research = await runResearchStep(packId);
      result.stepsRun.push("research");
      break;
    }
    case "generate": {
      result.generate = await runGenerateStep(packId);
      result.stepsRun.push("generate");
      await db.contextPack.update({
        where: { id: packId },
        data: { generatedAt: new Date() },
      });
      break;
    }
    default:
      break;
  }
}

/**
 * PRD v0.2 파이프라인 오케스트레이터.
 * analyze → research → generate 순서를 한 곳에서 정의하고, 각 단계는 기존 step 함수를 재사용해요.
 */
export async function runContextPackPipeline(
  packId: string,
  options: { target: PipelineRunTarget; force?: boolean } = { target: "researched" },
): Promise<PipelineRunResult> {
  const force = options.force ?? false;
  const stepsRun: PipelineStep[] = [];
  const result: PipelineRunResult = {
    status: derivePipelineStatus(await loadPack(packId)),
    stepsRun,
  };

  await clearPipelineError(packId);

  try {
    for (const step of targetSteps(options.target)) {
      let pack = await loadPack(packId);
      if (!needsStep(pack, step, force)) continue;

      await runStep(packId, step, result);

      pack = await loadPack(packId);
      if (step === "analyze" && pack.files.some((f) => !f.analyzedAt)) {
        result.status = derivePipelineStatus(pack);
        await clearPipelineRunning(packId);
        return result;
      }
    }

    await clearPipelineRunning(packId);
    result.status = derivePipelineStatus(await loadPack(packId));
    return result;
  } catch (err) {
    const step =
      err instanceof PipelineError ? err.step : ("analyze" satisfies PipelineStep);
    const message =
      err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
    await setPipelineError(packId, step, message);
    if (err instanceof PipelineError) throw err;
    throw new PipelineError(message, step, 502);
  }
}

/** SSE·폴링용 — 단계별 진행 이벤트를 yield해요. */
export async function* runContextPackPipelineStream(
  packId: string,
  options: { target: PipelineRunTarget; force?: boolean } = { target: "researched" },
): AsyncGenerator<PipelineProgressEvent> {
  const force = options.force ?? false;
  await clearPipelineError(packId);

  try {
    for (const step of targetSteps(options.target)) {
      let pack = await loadPack(packId);
      if (!needsStep(pack, step, force)) continue;

      yield { type: "step_start", step };
      const result: PipelineRunResult = { status: derivePipelineStatus(pack), stepsRun: [] };
      await runStep(packId, step, result);
      yield { type: "step_done", step };
      yield { type: "status", pipeline: derivePipelineStatus(await loadPack(packId)) };

      pack = await loadPack(packId);
      if (step === "analyze" && pack.files.some((f) => !f.analyzedAt)) {
        break;
      }
    }

    await clearPipelineRunning(packId);
    yield { type: "done", pipeline: derivePipelineStatus(await loadPack(packId)) };
  } catch (err) {
    const step =
      err instanceof PipelineError ? err.step : ("analyze" satisfies PipelineStep);
    const message =
      err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
    await setPipelineError(packId, step, message);
    yield { type: "error", step, message };
    throw err;
  }
}

export async function getContextPackPipelineStatus(packId: string) {
  const pack = await loadPack(packId);
  return { pack, status: derivePipelineStatus(pack) };
}
