/**
 * SQLite dev.db → PostgreSQL 데이터 이전 스크립트
 *
 * 사용법:
 *   docker compose up -d
 *   SQLITE_URL="file:./dev.db" \
 *   TARGET_DATABASE_URL="postgresql://messagehouse:messagehouse@localhost:5433/messagehouse" \
 *   npx tsx scripts/migrate-sqlite-to-pg.ts
 *
 * 옵션:
 *   --reset-pg   대상 PG 스키마를 db push 로 재생성 (기존 데이터 삭제)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import {
  bootstrapPostgresSchema,
  upgradePgEmbeddingsToVector,
} from "./lib/pg-bootstrap";

const SQLITE_URL = process.env.SQLITE_URL ?? "file:./dev.db";
const TARGET_DATABASE_URL =
  process.env.TARGET_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

const resetPg = process.argv.includes("--reset-pg");

if (!TARGET_DATABASE_URL?.startsWith("postgres")) {
  console.error("TARGET_DATABASE_URL (postgresql://...) 가 필요해요.");
  process.exit(1);
}

function sqlFile(name: string): string {
  return readFileSync(resolve(__dirname, `../prisma/postgresql/${name}`), "utf8");
}

async function runPgSql(pool: Pool, sql: string): Promise<void> {
  await pool.query(sql);
}

function createSqliteClient(): PrismaClient {
  const url = SQLITE_URL.replace(/^file:/, "");
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

async function bootstrapPostgres(pool: Pool): Promise<void> {
  if (resetPg) {
    console.log("→ PG public 스키마 재생성 + db push");
  } else {
    console.log("→ Prisma db push (schema.postgresql.prisma)");
  }
  await bootstrapPostgresSchema(TARGET_DATABASE_URL!, { reset: resetPg });
}

async function copyTableRows(
  pool: Pool,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const colList = columns.map((c) => `"${c}"`).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  for (const row of rows) {
    const values = columns.map((col) => row[col] ?? null);
    await pool.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    );
  }
  return rows.length;
}

async function main(): Promise<void> {
  const sqlite = createSqliteClient();
  const pool = new Pool({ connectionString: TARGET_DATABASE_URL });

  try {
    await bootstrapPostgres(pool);

    console.log("→ SQLite에서 데이터 읽기");

    const users = await sqlite.user.findMany();
    const teams = await sqlite.team.findMany();
    const members = await sqlite.teamMember.findMany();
    const sessions = await sqlite.session.findMany();
    const invites = await sqlite.teamInvite.findMany();
    const packs = await sqlite.contextPack.findMany();
    const files = await sqlite.sourceFile.findMany();
    const docChunks = await sqlite.documentChunk.findMany();
    const orgDocs = await sqlite.orgDocument.findMany();
    const orgChunks = await sqlite.orgDocumentChunk.findMany();

    console.log("→ PostgreSQL로 데이터 쓰기");

    const nUsers = await copyTableRows(pool, "User", [
      "id",
      "email",
      "name",
      "passwordHash",
      "createdAt",
      "updatedAt",
    ], users);
    const nTeams = await copyTableRows(pool, "Team", ["id", "name", "createdAt", "updatedAt"], teams);
    const nMembers = await copyTableRows(
      pool,
      "TeamMember",
      ["id", "teamId", "userId", "role", "createdAt"],
      members,
    );
    const nSessions = await copyTableRows(
      pool,
      "Session",
      ["id", "userId", "token", "expiresAt", "createdAt"],
      sessions,
    );
    const nInvites = await copyTableRows(
      pool,
      "TeamInvite",
      [
        "id",
        "teamId",
        "email",
        "role",
        "token",
        "invitedById",
        "expiresAt",
        "acceptedAt",
        "createdAt",
      ],
      invites,
    );
    const nPacks = await copyTableRows(
      pool,
      "ContextPack",
      [
        "id",
        "issue",
        "industry",
        "purpose",
        "targetAudience",
        "status",
        "version",
        "teamId",
        "createdById",
        "roofMessage",
        "pillars",
        "foundation",
        "objections",
        "aieoSummary",
        "riskFlags",
        "forbiddenTerms",
        "officialTerms",
        "researchResult",
        "researchedAt",
        "researchStatus",
        "analyzedAt",
        "generatedAt",
        "confirmedAt",
        "pipelineRunningStep",
        "pipelineError",
        "pipelineErrorStep",
        "gateMessageReviewed",
        "gateNoConfidential",
        "gateNumbersVerified",
        "createdAt",
        "updatedAt",
      ],
      packs,
    );
    const nFiles = await copyTableRows(
      pool,
      "SourceFile",
      [
        "id",
        "contextPackId",
        "filename",
        "mimeType",
        "sizeBytes",
        "extractedText",
        "docType",
        "topic",
        "claim",
        "numbers",
        "terms",
        "audience",
        "risk",
        "analyzedAt",
        "createdAt",
      ],
      files,
    );

    // 청크는 TEXT JSON 임베딩으로 먼저 삽입 → 이후 vector 변환
    for (const chunk of docChunks) {
      await pool.query(
        `INSERT INTO "DocumentChunk" (
          "id", "sourceFileId", "contextPackId", "chunkIndex",
          "text", "embedding", "model", "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [
          chunk.id,
          chunk.sourceFileId,
          chunk.contextPackId,
          chunk.chunkIndex,
          chunk.text,
          chunk.embedding,
          chunk.model,
          chunk.createdAt,
        ],
      );
    }

    const nOrgDocs = await copyTableRows(
      pool,
      "OrgDocument",
      [
        "id",
        "teamId",
        "uploadedById",
        "title",
        "description",
        "filename",
        "mimeType",
        "sizeBytes",
        "extractedText",
        "createdAt",
        "updatedAt",
      ],
      orgDocs,
    );

    for (const chunk of orgChunks) {
      await pool.query(
        `INSERT INTO "OrgDocumentChunk" (
          "id", "orgDocumentId", "chunkIndex", "text", "embedding", "model", "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          chunk.id,
          chunk.orgDocumentId,
          chunk.chunkIndex,
          chunk.text,
          chunk.embedding,
          chunk.model,
          chunk.createdAt,
        ],
      );
    }

    if (docChunks.length > 0 || orgChunks.length > 0) {
      console.log("→ embedding 컬럼 vector(1024) 변환 + HNSW 인덱스");
      await upgradePgEmbeddingsToVector(TARGET_DATABASE_URL!);
    }

    console.log("\n이전 완료:");
    console.log(`  User: ${nUsers}, Team: ${nTeams}, TeamMember: ${nMembers}, Session: ${nSessions}`);
    console.log(`  TeamInvite: ${nInvites}, ContextPack: ${nPacks}, SourceFile: ${nFiles}`);
    console.log(`  DocumentChunk: ${docChunks.length}, OrgDocument: ${nOrgDocs}, OrgDocumentChunk: ${orgChunks.length}`);
    console.log("\n다음 단계:");
    console.log(`  DATABASE_URL="${TARGET_DATABASE_URL}"`);
    console.log(`  VECTOR_BACKEND=pgvector npm run dev`);
  } finally {
    await sqlite.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
