import { db } from "@/lib/db";
import type { PipelineStep } from "./schema";

export async function setPipelineRunning(packId: string, step: PipelineStep) {
  await db.contextPack.update({
    where: { id: packId },
    data: {
      pipelineRunningStep: step,
      pipelineError: null,
      pipelineErrorStep: null,
    },
  });
}

export async function clearPipelineRunning(packId: string) {
  await db.contextPack.update({
    where: { id: packId },
    data: { pipelineRunningStep: null },
  });
}

export async function setPipelineError(
  packId: string,
  step: PipelineStep,
  message: string,
) {
  await db.contextPack.update({
    where: { id: packId },
    data: {
      pipelineRunningStep: null,
      pipelineError: message,
      pipelineErrorStep: step,
    },
  });
}

export async function clearPipelineError(packId: string) {
  await db.contextPack.update({
    where: { id: packId },
    data: { pipelineError: null, pipelineErrorStep: null },
  });
}
