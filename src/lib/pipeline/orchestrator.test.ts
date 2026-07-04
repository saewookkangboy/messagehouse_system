import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  contextPack: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const persistenceMock = {
  setPipelineRunning: vi.fn(),
  clearPipelineRunning: vi.fn(),
  setPipelineError: vi.fn(),
  clearPipelineError: vi.fn(),
};

const stepsMock = {
  runAnalyzeStep: vi.fn(),
  runResearchStep: vi.fn(),
  runGenerateStep: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./persistence", () => persistenceMock);
vi.mock("./steps", () => stepsMock);

const { runContextPackPipeline } = await import("./orchestrator");

function basePack(overrides: Record<string, unknown> = {}) {
  return {
    id: "pack-1",
    files: [{ id: "file-1", analyzedAt: null }],
    researchResult: null,
    researchStatus: "pending",
    roofMessage: null,
    ...overrides,
  };
}

describe("runContextPackPipeline — analyze failure surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.contextPack.update.mockResolvedValue({});
  });

  it("marks the analyze step as failed when every file errors out, instead of leaving it silently pending", async () => {
    dbMock.contextPack.findUnique.mockResolvedValue(basePack());
    stepsMock.runAnalyzeStep.mockResolvedValue({
      files: [{ id: "file-1", analyzedAt: null }],
      updatedCount: 0,
      errors: [{ filename: "doc.txt", message: "AI 응답이 예상 스키마와 달라요: numbers too small" }],
    });

    await runContextPackPipeline("pack-1", { target: "analyzed" });

    expect(persistenceMock.setPipelineError).toHaveBeenCalledWith(
      "pack-1",
      "analyze",
      expect.stringContaining("doc.txt"),
    );
  });

  it("does not mark analyze as failed when all files succeed", async () => {
    dbMock.contextPack.findUnique.mockResolvedValue(
      basePack({ files: [{ id: "file-1", analyzedAt: new Date() }] }),
    );
    stepsMock.runAnalyzeStep.mockResolvedValue({
      files: [{ id: "file-1", analyzedAt: new Date() }],
      updatedCount: 1,
      errors: [],
    });

    await runContextPackPipeline("pack-1", { target: "analyzed" });

    expect(persistenceMock.setPipelineError).not.toHaveBeenCalled();
  });
});
