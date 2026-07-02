/**
 * SQLite(in-memory) vs PostgreSQL(pgvector) RAG Top-K 회귀 diff
 *
 * 사용법:
 *   # Docker PG
 *   docker compose up -d
 *   npm run test:rag-regression
 *
 *   # Neon
 *   NEON_DATABASE_URL="postgresql://..." npm run test:rag-regression
 */
import "dotenv/config";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createPrismaClient } from "../src/lib/db/factory";
import { PgVectorSearch } from "../src/lib/embedding/vectorSearch/pg";
import {
  compareRetrievalResults,
  formatRegressionReport,
} from "../src/lib/embedding/vectorSearch/regression";
import { SqliteVectorSearch } from "../src/lib/embedding/vectorSearch/sqlite";
import {
  bootstrapPostgresSchema,
  resolvePgUrl,
  upgradePgEmbeddingsToVector,
  verifyPgVector,
} from "./lib/pg-bootstrap";
import {
  embedRegressionQuery,
  REGRESSION_IDS,
  REGRESSION_QUERIES,
  seedRegressionFixture,
} from "./lib/rag-regression-fixture";

const TOP_K = 5;

async function prepareSqlite(): Promise<{
  client: ReturnType<typeof createPrismaClient>;
  cleanup: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), "mh-rag-sqlite-"));
  const dbPath = join(dir, "test.db");

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  });

  const client = createPrismaClient(`file:${dbPath}`);
  await seedRegressionFixture(client, { pgVector: false });

  return {
    client,
    cleanup: () => {
      client.$disconnect().catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function preparePostgres(pgUrl: string): Promise<{
  client: ReturnType<typeof createPrismaClient>;
  cleanup: () => void;
}> {
  await bootstrapPostgresSchema(pgUrl, { reset: true });

  const client = createPrismaClient(pgUrl);
  await seedRegressionFixture(client, { pgVector: false });
  await client.$disconnect();

  await upgradePgEmbeddingsToVector(pgUrl);

  const ready = await verifyPgVector(pgUrl);
  if (!ready) {
    throw new Error("pgvector 부트스트랩 후 embedding 컬럼이 vector 타입이 아니에요.");
  }

  const connected = createPrismaClient(pgUrl);

  return {
    client: connected,
    cleanup: () => {
      connected.$disconnect().catch(() => {});
    },
  };
}

async function main(): Promise<void> {
  const pgUrl = resolvePgUrl();
  console.log(`PostgreSQL: ${pgUrl.replace(/:[^:@]+@/, ":****@")}`);

  const sqlite = await prepareSqlite();
  let pg: Awaited<ReturnType<typeof preparePostgres>>;

  try {
    pg = await preparePostgres(pgUrl);
  } catch (err) {
    sqlite.cleanup();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nPostgreSQL 연결/부트스트랩 실패: ${message}`);
    console.error("\n확인 사항:");
    console.error("  - Docker: docker compose up -d");
    console.error("  - Neon: NEON_DATABASE_URL=postgresql://... 설정");
    process.exit(1);
  }

  const sqliteSearch = new SqliteVectorSearch(sqlite.client);
  const pgSearch = new PgVectorSearch(pg.client);
  const results = [];

  try {
    for (const query of REGRESSION_QUERIES) {
      const queryVector = await embedRegressionQuery(query);

      const sqlitePack = await sqliteSearch.searchPackChunks({
        contextPackId: REGRESSION_IDS.packId,
        queryVector,
        topK: TOP_K,
      });
      const pgPack = await pgSearch.searchPackChunks({
        contextPackId: REGRESSION_IDS.packId,
        queryVector,
        topK: TOP_K,
      });

      results.push(
        compareRetrievalResults({
          query: `[pack] ${query}`,
          sqlite: sqlitePack,
          pg: pgPack,
        }),
      );

      const sqliteOrg = await sqliteSearch.searchOrgChunks({
        teamId: REGRESSION_IDS.teamId,
        queryVector,
        topK: TOP_K,
      });
      const pgOrg = await pgSearch.searchOrgChunks({
        teamId: REGRESSION_IDS.teamId,
        queryVector,
        topK: TOP_K,
      });

      results.push(
        compareRetrievalResults({
          query: `[org] ${query}`,
          sqlite: sqliteOrg,
          pg: pgOrg,
        }),
      );
    }
  } finally {
    sqlite.cleanup();
    pg.cleanup();
  }

  const report = formatRegressionReport(results);
  console.log(`\n${report}\n`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
