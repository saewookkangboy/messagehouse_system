import { readFileSync, statSync } from "node:fs";
import { extractText } from "../src/lib/fileParsing";
import { chunkText } from "../src/lib/rag/chunking";

const pdfPath =
  process.argv[2] ?? "/Users/chunghyo/Desktop/Hanwha_Life_Sustainability_Report.pdf";

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

async function main(): Promise<void> {
  const stat = statSync(pdfPath);
  const buffer = readFileSync(pdfPath);

  console.log("=== 파일 정보 ===");
  console.log("경로:", pdfPath);
  console.log("크기:", `${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  const start = Date.now();
  const text = await extractText({
    filename: "Hanwha_Life_Sustainability_Report.pdf",
    buffer,
  });
  const elapsed = Date.now() - start;

  const hangul = countMatches(text, /[가-힣]/g);
  const latin = countMatches(text, /[A-Za-z]/g);
  const htmlTags = countMatches(text, /<[^>]+>/g);
  const brokenParticles = countMatches(text, /[가-힣A-Za-z0-9] (?:은|는|이|가|을|를|의)/g);

  console.log("\n=== 추출 결과 ===");
  console.log("소요 시간:", `${elapsed} ms`);
  console.log("추출 문자 수:", text.length.toLocaleString());
  console.log("한글 비율:", `${((hangul / (hangul + latin)) * 100).toFixed(1)}%`);
  console.log("HTML 태그 잔여:", htmlTags);
  console.log("조사 앞 공백 오류:", brokenParticles);

  const keywords = [
    "한화생명",
    "지속가능",
    "ESG",
    "환경",
    "사회",
    "거버넌스",
    "탄소",
    "기후",
    "임직원",
    "고객",
    "보험",
    "GRI",
    "TCFD",
    "2022",
    "2023",
  ];
  console.log("\n=== 키워드 포함 여부 ===");
  for (const kw of keywords) {
    const count = countMatches(text, new RegExp(kw, "g"));
    console.log(`${kw}: ${count > 0 ? `✓ (${count}회)` : "✗"}`);
  }

  const chunks = chunkText(text);
  console.log("\n=== 청킹 결과 ===");
  console.log("청크 수:", chunks.length);
  console.log(
    "평균 청크 길이:",
    Math.round(chunks.reduce((s, c) => s + c.length, 0) / chunks.length),
  );

  // RAG 시뮬레이션: 주제별 쿼리 키워드가 청크에 포함되는지
  const ragQueries = [
    { label: "ESG/지속가능", terms: ["ESG", "지속가능", "GRI"] },
    { label: "환경/기후", terms: ["탄소", "기후", "환경"] },
    { label: "사회/고객", terms: ["고객", "임직원", "사회"] },
    { label: "거버넌스", terms: ["거버넌스", "이사회", "윤리"] },
  ];
  console.log("\n=== RAG 청크 커버리지 (키워드 매칭) ===");
  for (const q of ragQueries) {
    const hits = chunks.filter((c) => q.terms.some((t) => c.includes(t))).length;
    console.log(`${q.label}: ${hits}/${chunks.length} 청크 (${((hits / chunks.length) * 100).toFixed(0)}%)`);
  }

  console.log("\n=== 앞부분 (600자) ===");
  console.log(text.slice(0, 600));

  console.log("\n=== ESG 섹션 샘플 ===");
  const esgIdx = text.indexOf("ESG");
  if (esgIdx >= 0) console.log(text.slice(esgIdx, esgIdx + 600));

  console.log("\n=== 환경/기후 섹션 샘플 ===");
  const climateIdx = text.indexOf("기후변화");
  const idx = climateIdx >= 0 ? climateIdx : text.indexOf("탄소");
  if (idx >= 0) console.log(text.slice(idx, idx + 600));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
