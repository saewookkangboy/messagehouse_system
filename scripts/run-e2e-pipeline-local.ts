/**
 * HTTP 인증 없이 파이프라인 함수를 직접 호출하는 E2E (dev 서버 AUTH 활성화 시).
 * 업로드 → 분석 → 리서치 → 생성 전체 흐름을 실제 DB·AI·임베딩으로 검증해요.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { db } from "../src/lib/db";
import { extractText } from "../src/lib/fileParsing";
import { encryptField } from "../src/lib/fieldCrypto";
import { deserializePillars, deserializeStringList } from "../src/lib/contextPackSerialization";
import { runContextPackPipeline } from "../src/lib/pipeline";

const PDF_PATH =
  process.argv[2] ?? "/Users/chunghyo/Desktop/Hanwha_Life_Sustainability_Report.pdf";

function fmt(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`;
}

async function resolveTeamId(): Promise<string> {
  const member = await db.teamMember.findFirst({
    orderBy: { createdAt: "asc" },
    select: { teamId: true },
  });
  if (member) return member.teamId;
  const team = await db.team.create({ data: { name: "E2E Test Team" } });
  return team.id;
}

async function main(): Promise<void> {
  const pdfName = basename(PDF_PATH);
  const buffer = readFileSync(PDF_PATH);
  console.log("=== E2E 파이프라인 (in-process) ===");
  console.log(`PDF: ${PDF_PATH} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`);

  const teamId = await resolveTeamId();
  let t0 = Date.now();

  const pack = await db.contextPack.create({
    data: {
      issue: "한화생명 2023 지속가능경영보고서 기반 ESG 메시지하우스",
      industry: "보험",
      purpose: "지속가능경영보고서 핵심 메시지 정리 및 대외 커뮤니케이션",
      targetAudience: "투자자, 이해관계자, 언론",
      teamId,
    },
  });
  console.log(`[1/4] 팩 생성 ✓ (${fmt((Date.now() - t0) / 1000)}) → ${pack.id}`);

  t0 = Date.now();
  const text = await extractText({ filename: pdfName, buffer });
  const file = await db.sourceFile.create({
    data: {
      contextPackId: pack.id,
      filename: pdfName,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      extractedText: encryptField(text),
    },
  });
  console.log(
    `[2/4] 업로드·추출 ✓ (${fmt((Date.now() - t0) / 1000)}) → ${text.length.toLocaleString()}자`,
  );

  console.log("\n[3/4] 파이프라인 실행 (분석 → 리서치 → 생성)...");
  console.log("      RAG 인덱싱(185청크) + AI 호출 — 수 분 소요될 수 있어요.\n");
  t0 = Date.now();

  const result = await runContextPackPipeline(pack.id, { target: "generated" });
  const elapsed = (Date.now() - t0) / 1000;

  if (result.analyze?.errors?.length) {
    console.error("분석 오류:", result.analyze.errors);
    process.exit(1);
  }

  const updated = await db.contextPack.findUnique({
    where: { id: pack.id },
    include: { files: true },
  });
  if (!updated?.roofMessage) {
    console.error(`파이프라인 미완료 (${fmt(elapsed)}):`, result);
    process.exit(1);
  }

  console.log(`[3/4] 파이프라인 ✓ (${fmt(elapsed)})`);
  console.log(`      단계: ${result.stepsRun.join(" → ")}`);

  const src = updated.files[0];
  console.log("\n=== 분석 결과 ===");
  if (src) {
    console.log(`핵심 주제: ${src.topic ?? "(없음)"}`);
    console.log(`핵심 주장: ${src.claim ?? "(없음)"}`);
    console.log(`수치/데이터: ${src.numbers ?? "(없음)"}`);
    console.log(`공식 용어: ${src.terms ?? "(없음)"}`);
    console.log(`대상 독자: ${src.audience ?? "(없음)"}`);
    console.log(`리스크: ${src.risk ?? "(없음)"}`);
  }

  console.log("\n=== 메시지하우스 ===");
  console.log(`루프 메시지: ${updated.roofMessage}`);

  const pillars = deserializePillars(updated.pillars);
  console.log(`\nPillars (${pillars.length}개):`);
  for (const p of pillars) {
    console.log(`  [${p.id}] ${p.message}`);
  }
  if (updated.foundation) {
    const preview = updated.foundation.slice(0, 400);
    console.log(`\nFoundation: ${preview}${updated.foundation.length > 400 ? "…" : ""}`);
  }
  const riskFlags = deserializeStringList(updated.riskFlags);
  if (riskFlags.length) {
    console.log(`\nRisk flags: ${riskFlags.join(", ")}`);
  }

  const chunkCount = await db.documentChunk.count({ where: { sourceFileId: file.id } });
  console.log(`\n[4/4] RAG 인덱스: ${chunkCount}청크`);
  console.log(`\n리뷰 URL: http://localhost:3000/packs/${pack.id}/review`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
