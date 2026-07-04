import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgeExpiredSourceFiles, DEFAULT_RETENTION_DAYS } from "@/lib/retention";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * 보존 기간 지난 업로드 원본 파일 정리 — 외부 스케줄러(GitHub Actions cron)가 호출해요.
 * MAINTENANCE_SECRET 헤더로 보호돼요. 세션 인증은 미들웨어 public path로 우회하고,
 * 대신 이 시크릿으로 인가해요.
 */
export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "MAINTENANCE_SECRET가 설정되지 않아 유지보수 작업이 비활성화됐어요." },
      { status: 503 },
    );
  }
  const provided = request.headers.get("x-maintenance-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "인가되지 않은 요청이에요." }, { status: 401 });
  }

  const days = Number(process.env.FILE_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const result = await purgeExpiredSourceFiles(days);
  return NextResponse.json({ ok: true, retentionDays: days, ...result });
}
