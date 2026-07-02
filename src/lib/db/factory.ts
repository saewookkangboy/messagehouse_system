import { PrismaClient as SqlitePrismaClient } from "@/generated/prisma/client";
import { PrismaClient as PgPrismaClient } from "@/generated/prisma-pg/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getDatabaseUrl } from "./config";
import type { AppPrismaClient } from "./types";

export function createPrismaClient(databaseUrl = getDatabaseUrl()): AppPrismaClient {
  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    const pool = new Pool({ connectionString: databaseUrl, max: 5 });
    const adapter = new PrismaPg(pool);
    return new PgPrismaClient({ adapter }) as AppPrismaClient;
  }

  const url = databaseUrl.replace(/^file:/, "");
  const adapter = new PrismaBetterSqlite3({ url });
  return new SqlitePrismaClient({ adapter });
}
