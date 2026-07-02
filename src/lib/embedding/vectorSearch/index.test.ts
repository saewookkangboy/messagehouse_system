import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetVectorSearchForTests, getVectorSearch } from "./index";
import { SqliteVectorSearch } from "./sqlite";

describe("getVectorSearch", () => {
  afterEach(() => {
    _resetVectorSearchForTests();
    vi.unstubAllEnvs();
  });

  it("기본(SQLite DB)이면 SqliteVectorSearch", () => {
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    vi.stubEnv("VECTOR_BACKEND", "");
    expect(getVectorSearch()).toBeInstanceOf(SqliteVectorSearch);
  });

  it("VECTOR_BACKEND=sqlite 이면 SqliteVectorSearch", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/db");
    vi.stubEnv("VECTOR_BACKEND", "sqlite");
    expect(getVectorSearch()).toBeInstanceOf(SqliteVectorSearch);
  });
});
