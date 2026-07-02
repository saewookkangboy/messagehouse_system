import { describe, expect, it, vi } from "vitest";
import {
  getDatabaseProvider,
  getDatabaseUrl,
  getVectorBackend,
} from "./config";

describe("db config", () => {
  it("file URL은 sqlite", () => {
    expect(getDatabaseProvider()).toBe("sqlite");
  });

  it("sqlite 환경 기본 vector backend는 sqlite", () => {
    expect(getVectorBackend()).toBe("sqlite");
  });

  it("DATABASE_URL=file: 이면 NEON_DATABASE_URL보다 우선", () => {
    vi.stubEnv("DATABASE_URL", "file:./e2e.db");
    vi.stubEnv("NEON_DATABASE_URL", "postgresql://user:pass@host/db");
    expect(getDatabaseUrl()).toBe("file:./e2e.db");
    vi.unstubAllEnvs();
  });
});
