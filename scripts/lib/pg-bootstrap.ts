import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { Pool } from "pg";

const DEFAULT_LOCAL_PG =
  "postgresql://messagehouse:messagehouse@localhost:5433/messagehouse";

export function resolvePgUrl(): string {
  return (
    process.env.NEON_DATABASE_URL ??
    process.env.TEST_PG_URL ??
    process.env.TARGET_DATABASE_URL ??
    process.env.DIRECT_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined) ??
    DEFAULT_LOCAL_PG
  );
}

function sqlFile(name: string): string {
  return readFileSync(resolve(__dirname, `../../prisma/postgresql/${name}`), "utf8");
}

/** PostgreSQL(Neon/Docker)에 pgvector + Prisma 스키마를 부트스트랩해요. */
export async function bootstrapPostgresSchema(
  databaseUrl: string,
  options: { reset?: boolean } = {},
): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(sqlFile("001_enable_pgvector.sql"));

    if (options.reset) {
      // prisma migrate reset 대신 스키마 재생성 (CI·로컬 Docker 전용)
      await pool.query(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
      await pool.query(`GRANT ALL ON SCHEMA public TO PUBLIC;`);
      await pool.query(sqlFile("001_enable_pgvector.sql"));
    }

    execSync(`npx prisma db push --schema prisma/schema.postgresql.prisma --accept-data-loss`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  } finally {
    await pool.end();
  }
}

/** 청크 데이터가 TEXT JSON 으로 들어간 뒤 vector(1024) + HNSW 로 변환해요. */
export async function upgradePgEmbeddingsToVector(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(sqlFile("002_vector_columns.sql"));
  } finally {
    await pool.end();
  }
}

export async function verifyPgVector(databaseUrl: string): Promise<boolean> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const ext = await pool.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
    );
    if (ext.rowCount === 0) return false;

    const col = await pool.query(
      `SELECT data_type, udt_name
       FROM information_schema.columns
       WHERE table_name = 'DocumentChunk' AND column_name = 'embedding'`,
    );
    return col.rows[0]?.udt_name === "vector";
  } finally {
    await pool.end();
  }
}
