import type { ContextPack, SourceFile } from "@/generated/prisma/client";
import type { ResearchResult } from "@/lib/research/schema";

/** PRD v0.2 파이프라인 단계 — DB enum 없이 기존 필드로 유도해요. */
export type PipelineStep =
  | "upload"
  | "analyze"
  | "research"
  | "generate"
  | "review"
  | "confirm"
  | "export";

export type PipelineStepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export type PipelineStatus = {
  currentStep: PipelineStep;
  steps: Record<PipelineStep, PipelineStepStatus>;
  runningStep: PipelineStep | null;
  error: string | null;
  errorStep: PipelineStep | null;
  canGenerate: boolean;
  canConfirm: boolean;
  canExport: boolean;
};

export type PackWithFiles = ContextPack & { files: SourceFile[] };

export type AnalyzeStepResult = {
  files: SourceFile[];
  updatedCount: number;
  errors: Array<{ filename: string; message: string }>;
};

export type ResearchStepResult = {
  contextPack: ContextPack;
  research: ResearchResult;
};

export type GenerateStepResult = {
  contextPack: ContextPack;
};

export type PipelineRunTarget = "analyzed" | "researched" | "generated";

export type PipelineProgressEvent =
  | { type: "step_start"; step: PipelineStep }
  | { type: "step_done"; step: PipelineStep }
  | { type: "status"; pipeline: PipelineStatus }
  | { type: "error"; step: PipelineStep; message: string }
  | { type: "done"; pipeline: PipelineStatus };

export type PipelineRunResult = {
  status: PipelineStatus;
  analyze?: AnalyzeStepResult;
  research?: ResearchStepResult;
  generate?: GenerateStepResult;
  stepsRun: PipelineStep[];
};

export class PipelineError extends Error {
  constructor(
    message: string,
    readonly step: PipelineStep,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}
