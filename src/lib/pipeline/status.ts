import { canConfirm } from "@/lib/contextPackSerialization";
import type { PackWithFiles, PipelineStatus, PipelineStep } from "./schema";

const ORDER: PipelineStep[] = [
  "upload",
  "analyze",
  "research",
  "generate",
  "review",
  "confirm",
  "export",
];

function stepStatus(
  done: boolean,
  running: boolean,
  failed: boolean,
  skipped = false,
): PipelineStatus["steps"][PipelineStep] {
  if (failed) return "failed";
  if (running) return "running";
  if (skipped) return "skipped";
  return done ? "done" : "pending";
}

export function derivePipelineStatus(pack: PackWithFiles): PipelineStatus {
  const hasFiles = pack.files.length > 0;
  const allAnalyzed =
    hasFiles && pack.files.every((f) => f.analyzedAt !== null);
  const hasResearch =
    pack.researchResult !== null || pack.researchStatus === "completed";
  const hasMessageHouse = pack.roofMessage !== null;
  const isConfirmed = pack.status === "confirmed";
  const isReview = pack.status === "review" || isConfirmed;
  const runningStep = (pack.pipelineRunningStep as PipelineStep | null) ?? null;
  const errorStep = (pack.pipelineErrorStep as PipelineStep | null) ?? null;

  const steps = {
    upload: stepStatus(hasFiles, runningStep === "upload", errorStep === "upload"),
    analyze: stepStatus(
      allAnalyzed,
      runningStep === "analyze",
      errorStep === "analyze",
    ),
    research: stepStatus(
      hasResearch,
      runningStep === "research",
      errorStep === "research",
      !allAnalyzed,
    ),
    generate: stepStatus(
      hasMessageHouse,
      runningStep === "generate",
      errorStep === "generate",
      !allAnalyzed,
    ),
    review: stepStatus(
      isReview && hasMessageHouse,
      false,
      false,
    ),
    confirm: stepStatus(isConfirmed, false, false),
    export: stepStatus(isConfirmed, false, false),
  } satisfies PipelineStatus["steps"];

  let currentStep: PipelineStep = "upload";
  if (runningStep) currentStep = runningStep;
  else if (pack.pipelineError && errorStep) currentStep = errorStep;
  else if (!hasFiles) currentStep = "upload";
  else if (!allAnalyzed) currentStep = "analyze";
  else if (!hasResearch) currentStep = "research";
  else if (!hasMessageHouse) currentStep = "generate";
  else if (!isConfirmed) currentStep = "review";
  else currentStep = "export";

  return {
    currentStep,
    steps,
    runningStep,
    error: pack.pipelineError,
    errorStep,
    canGenerate: allAnalyzed && hasResearch && !hasMessageHouse && !runningStep,
    canConfirm:
      hasMessageHouse &&
      pack.status === "review" &&
      canConfirm({
        gateMessageReviewed: pack.gateMessageReviewed,
        gateNoConfidential: pack.gateNoConfidential,
        gateNumbersVerified: pack.gateNumbersVerified,
      }),
    canExport: hasMessageHouse,
  };
}

export function targetSteps(target: "analyzed" | "researched" | "generated"): PipelineStep[] {
  const end = ORDER.indexOf(
    target === "analyzed" ? "analyze" : target === "researched" ? "research" : "generate",
  );
  return ORDER.slice(1, end + 1);
}
