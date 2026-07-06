/**
 * 한화생명 지속가능경영보고서 E2E: 팩 생성 → 업로드 → 분석 → 리서치 → 생성
 *
 * 사용법:
 *   npx tsx scripts/run-e2e-pipeline.ts [pdf-path]
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const BASE = process.env.API_BASE ?? "http://localhost:3000";
const PDF_PATH =
  process.argv[2] ?? "/Users/chunghyo/Desktop/Hanwha_Life_Sustainability_Report.pdf";

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

function fmt(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`;
}

async function main(): Promise<void> {
  const pdfName = basename(PDF_PATH);
  const pdfBuffer = readFileSync(PDF_PATH);
  console.log(`=== E2E 파이프라인 ===`);
  console.log(`서버: ${BASE}`);
  console.log(`PDF: ${PDF_PATH} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)\n`);

  // 1. Context Pack 생성
  let t0 = Date.now();
  const create = await api<{ contextPack: { id: string }; error?: string }>(
    "/api/context-packs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue: "한화생명 2023 지속가능경영보고서 기반 ESG 메시지하우스",
        industry: "보험",
        purpose: "지속가능경영보고서 핵심 메시지 정리 및 대외 커뮤니케이션",
        targetAudience: "투자자, 이해관계자, 언론",
      }),
    },
  );
  if (!create.ok) {
    console.error("팩 생성 실패:", create.body);
    process.exit(1);
  }
  const packId = create.body.contextPack.id;
  console.log(`[1/4] 팩 생성 ✓ (${fmt((Date.now() - t0) / 1000)}) → ${packId}`);

  // 2. PDF 업로드
  t0 = Date.now();
  const form = new FormData();
  form.append(
    "files",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    pdfName,
  );
  const upload = await api<{
    files?: Array<{ id: string; filename: string; sizeBytes: number }>;
    errors?: Array<{ filename: string; message: string }>;
    error?: string;
  }>(`/api/context-packs/${packId}/files`, { method: "POST", body: form });
  if (!upload.ok || !upload.body.files?.length) {
    console.error("업로드 실패:", upload.body);
    process.exit(1);
  }
  const file = upload.body.files[0]!;
  console.log(
    `[2/4] 업로드 ✓ (${fmt((Date.now() - t0) / 1000)}) → ${file.filename} (${(file.sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
  );

  // 3. 파이프라인 실행 (analyze → research → generate)
  console.log(`\n[3/4] 파이프라인 실행 중 (분석 → 리서치 → 생성)...`);
  console.log(`      대용량 PDF: RAG 인덱싱 + AI 호출로 수 분 소요될 수 있어요.\n`);
  t0 = Date.now();
  const pipeline = await api<{
    contextPack: {
      id: string;
      status: string;
      roofMessage: string | null;
      analyzedAt: string | null;
      researchedAt: string | null;
      generatedAt: string | null;
      files: Array<{
        filename: string;
        topic: string | null;
        claim: string | null;
        numbers: string | null;
        analyzedAt: string | null;
      }>;
    };
    stepsRun?: string[];
    analyze?: { updatedCount: number; errors: Array<{ filename: string; message: string }> };
    research?: unknown;
    generate?: unknown;
    error?: string;
    step?: string;
  }>(`/api/context-packs/${packId}/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "generated" }),
  });

  const elapsed = (Date.now() - t0) / 1000;
  if (!pipeline.ok) {
    console.error(`파이프라인 실패 (${fmt(elapsed)}):`, pipeline.body);
    process.exit(1);
  }

  console.log(`[3/4] 파이프라인 ✓ (${fmt(elapsed)})`);
  console.log(`      실행 단계: ${pipeline.body.stepsRun?.join(" → ") ?? "?"}`);

  const analyzed = pipeline.body.analyze;
  if (analyzed?.errors?.length) {
    console.log(`      분석 오류:`, analyzed.errors);
  }

  const pack = pipeline.body.contextPack;
  const src = pack.files[0];

  console.log(`\n=== 분석 결과 ===`);
  if (src) {
    console.log(`파일: ${src.filename}`);
    console.log(`핵심 주제: ${src.topic ?? "(없음)"}`);
    console.log(`핵심 주장: ${src.claim ?? "(없음)"}`);
    console.log(`수치/데이터: ${src.numbers ?? "(없음)"}`);
  }

  console.log(`\n=== 메시지하우스 생성 결과 ===`);
  console.log(`상태: ${pack.status}`);
  console.log(`루프 메시지: ${pack.roofMessage ?? "(없음)"}`);

  // 4. Export JSON
  t0 = Date.now();
  const exportRes = await fetch(`${BASE}/api/context-packs/${packId}/export?format=json`);
  const exportBody = (await exportRes.json()) as { text?: string; error?: string };
  if (exportRes.ok && exportBody.text) {
    const exported = JSON.parse(exportBody.text) as {
      roof_message?: string;
      pillars?: Array<{ id: string; message: string; foundation?: string }>;
      foundation?: string;
      risk_flags?: string[];
    };
    console.log(`\n=== Pillars (${exported.pillars?.length ?? 0}개) ===`);
    for (const p of exported.pillars ?? []) {
      console.log(`  [${p.id}] ${p.message}`);
    }
    if (exported.foundation) {
      console.log(`\nFoundation: ${exported.foundation.slice(0, 300)}${exported.foundation.length > 300 ? "…" : ""}`);
    }
    if (exported.risk_flags?.length) {
      console.log(`\nRisk flags: ${exported.risk_flags.join(", ")}`);
    }
    console.log(`\n[4/4] Export ✓ (${fmt((Date.now() - t0) / 1000)})`);
    console.log(`\n리뷰 URL: ${BASE}/packs/${packId}/review`);
  } else {
    console.log(`\n[4/4] Export 실패:`, exportBody.error ?? exportRes.status);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
