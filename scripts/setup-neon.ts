/**
 * Neon Postgres 스키마 부트스트랩
 *
 * 사전 준비:
 *   1. https://console.neon.tech 에서 프로젝트 생성
 *   2. Connection string 복사 (pooled 또는 direct)
 *   3. NEON_DATABASE_URL 환경변수 설정
 *
 * 사용법:
 *   NEON_DATABASE_URL="postgresql://..." npm run db:neon:setup
 */
import "dotenv/config";
import {
  bootstrapPostgresSchema,
  resolvePgUrl,
  verifyPgVector,
} from "./lib/pg-bootstrap";

async function main(): Promise<void> {
  const url = resolvePgUrl();

  if (!process.env.NEON_DATABASE_URL && !url.includes("neon.tech")) {
    console.warn(
      "NEON_DATABASE_URL 이 없어요. Neon 콘솔 connection string 을 설정하거나",
    );
    console.warn("로컬 Docker URL 로 부트스트랩합니다.\n");
  }

  console.log(`→ 스키마 부트스트랩: ${url.replace(/:[^:@]+@/, ":****@")}`);
  await bootstrapPostgresSchema(url, { reset: false });

  const hasVector = await verifyPgVector(url);
  console.log(hasVector ? "✓ pgvector extension 확인" : "⚠ vector 컬럼 미변환 (청크 이전 후 002 실행)");

  console.log("\n다음 단계:");
  console.log("  NEON_DATABASE_URL=\"...\" VECTOR_BACKEND=pgvector npm run dev");
  console.log("  NEON_DATABASE_URL=\"...\" npm run test:rag-regression");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
