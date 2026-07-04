/**
 * 유지보수 정리 라우트 — 시크릿 인가.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/retention", () => ({
  DEFAULT_RETENTION_DAYS: 30,
  purgeExpiredSourceFiles: vi.fn(async () => ({ deleted: 3, cutoff: "2026-01-01" })),
}));

const { purgeExpiredSourceFiles } = await import("@/lib/retention");
const { POST } = await import("./route");

afterEach(() => vi.unstubAllEnvs());

function req(secret?: string) {
  return new Request("http://localhost/api/maintenance/purge", {
    method: "POST",
    headers: secret ? { "x-maintenance-secret": secret } : {},
  });
}

describe("POST /api/maintenance/purge", () => {
  it("MAINTENANCE_SECRET 미설정이면 503", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", "");
    const res = await POST(req("anything"));
    expect(res.status).toBe(503);
  });

  it("시크릿이 틀리면 401", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", "correct-secret");
    const res = await POST(req("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("시크릿이 없으면 401", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", "correct-secret");
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("시크릿이 맞으면 정리를 실행하고 개수를 반환해요", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", "correct-secret");
    const res = await POST(req("correct-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(3);
    expect(vi.mocked(purgeExpiredSourceFiles)).toHaveBeenCalled();
  });
});
