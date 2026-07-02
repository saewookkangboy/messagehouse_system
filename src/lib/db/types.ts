import type { PrismaClient as SqlitePrismaClient } from "@/generated/prisma/client";

/**
 * SQLite·PostgreSQL 클라이언트는 동일 스키마를 공유하지만 생성 타입이 달라
 * union으로 두면 Prisma 메서드 호출이 타입 오류가 납니다. 런타임 API는 동일하므로
 * SQLite 클라이언트 타입을 공통 인터페이스로 사용해요.
 */
export type AppPrismaClient = SqlitePrismaClient;
