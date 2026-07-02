export type DatabaseProvider = "sqlite" | "postgresql";
export type VectorBackend = "sqlite" | "pgvector";

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith("postgres")) {
    return databaseUrl;
  }
  if (databaseUrl?.startsWith("file:")) {
    return databaseUrl;
  }
  if (process.env.NEON_DATABASE_URL?.startsWith("postgres")) {
    return process.env.NEON_DATABASE_URL;
  }
  return databaseUrl ?? "file:./dev.db";
}

export function getDatabaseProvider(): DatabaseProvider {
  const url = getDatabaseUrl();
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

/**
 * VECTOR_BACKEND=sqlite|pgvector 로 강제 지정 가능.
 * 미설정 시 DB 프로바이더에 맞춰 자동 선택해요.
 */
export function getVectorBackend(): VectorBackend {
  const mode = process.env.VECTOR_BACKEND;
  if (mode === "pgvector") return "pgvector";
  if (mode === "sqlite") return "sqlite";
  return getDatabaseProvider() === "postgresql" ? "pgvector" : "sqlite";
}

export function isPgVectorEnabled(): boolean {
  return getVectorBackend() === "pgvector" && getDatabaseProvider() === "postgresql";
}
