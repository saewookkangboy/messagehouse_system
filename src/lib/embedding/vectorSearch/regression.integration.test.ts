/**
 * TEST_PG_URL 또는 NEON_DATABASE_URL 이 있을 때만 실행되는 PG RAG 회귀 통합 테스트
 */
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const pgUrl = process.env.TEST_PG_URL ?? process.env.NEON_DATABASE_URL;

describe.skipIf(!pgUrl)("PG RAG regression (integration)", () => {
  it("SQLite vs pgvector Top-K diff", () => {
    execSync("npx tsx scripts/rag-regression-diff.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        TEST_PG_URL: pgUrl,
        NEON_DATABASE_URL: pgUrl,
      },
    });
    expect(pgUrl).toMatch(/^postgres/);
  }, 120_000);
});
