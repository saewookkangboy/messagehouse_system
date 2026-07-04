import { db } from "@/lib/db";

export const DEFAULT_RETENTION_DAYS = 30;

/**
 * 보존 기간이 지난 업로드 원본 파일(SourceFile)을 삭제해요 (PRD: 30일 자동 삭제).
 *
 * "파일 자동 삭제"의 문자 그대로 해석 — 업로드된 원본 텍스트만 지워요.
 * 생성된 메시지하우스(결과물)와 Context Pack 자체는 남겨요. SourceFile 삭제 시
 * DocumentChunk는 Cascade로 함께 지워져요. 조직 문서 라이브러리(OrgDocument)는
 * 팀의 의도적 지식베이스라 대상이 아니에요.
 *
 * now를 주입받아 순수하게 테스트할 수 있어요.
 */
export async function purgeExpiredSourceFiles(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  now: Date = new Date(),
): Promise<{ deleted: number; cutoff: string }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.sourceFile.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
