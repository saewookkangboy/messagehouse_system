import type { AppPrismaClient } from "./db/types";
import { createPrismaClient } from "./db/factory";
import { getDatabaseProvider, getDatabaseUrl } from "./db/config";

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

export const db: AppPrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(getDatabaseUrl());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export { createPrismaClient, getDatabaseProvider, getDatabaseUrl };
