import type { DocumentAnalysis } from "./schema";
import type { ResearchResult } from "../research/schema";
import type { RetrievedChunk } from "../rag/schema";

function buildResearchBlock(research: ResearchResult | null | undefined): string {
  if (!research) return "";
  return `

[자동 리서치 결과]
업계 트렌드: ${research.industryTrends.join(" / ")}
경쟁사 동향: ${research.competitorMoves.join(" / ")}
규제 현황: ${research.regulations.join(" / ")}
AIEO 키워드: ${research.aieoKeywords.join(", ")}
차별화 포인트: ${research.differentiationPoint}

기둥 3개 중 하나는 위 리서치 결과를 활용해 "source": "research_enhanced"로 작성하세요.`;
}

function buildRagBlock(chunks: RetrievedChunk[] | null | undefined): string {
  if (!chunks || chunks.length === 0) return "";
  const body = chunks
    .map((c, i) => {
      const label = c.source === "org_library" ? "조직 문서" : "업로드 파일";
      return `[${label} ${i + 1}: ${c.filename} #${c.chunkIndex + 1}]\n${c.text}`;
    })
    .join("\n\n");
  return `

[RAG 검색 — 관련 원문 발췌]
아래는 벡터 검색으로 찾은 관련 원문입니다(업로드 파일 + 조직 문서 라이브러리). evidence·foundation·riskFlags 작성 시 우선 참고하세요.

${body}`;
}

export const SYSTEM_PROMPT = `당신은 대기업 홍보팀을 위한 메시지하우스 전문 PR 컨설턴트입니다.
반드시 요청받은 JSON 스키마와 정확히 일치하는 JSON만 응답하세요. 설명 문장이나 코드펜스 없이 순수 JSON 객체 하나만 출력하세요.
모든 문자열 값은 한국어 존댓말로 작성하세요.
업로드 문서·작성 맥락(주제/기업명)에 없는 사실·수치·회사명·브랜드명·데모 예시 문구를 절대 만들어내지 마세요.
주제(issue)에 적힌 기업/브랜드와 다른 회사명을 쓰지 마세요. 경쟁사명으로 바꿔도 동일한 문장을 반복하지 말고, 해당 기업·문서에 맞게 다시 작성하세요.`;

export function buildAnalyzePrompt(filename: string, text: string): string {
  return `다음은 "${filename}" 파일에서 추출한 텍스트입니다. 이 문서를 분석해서 아래 JSON 스키마에 맞게 핵심 정보를 추출하세요.

스키마:
{
  "docType": "문서 목적 분류 (예: 보도자료, 기획안, IR, 내부보고)",
  "topic": "핵심 주제",
  "claim": "핵심 주장",
  "numbers": "문서의 핵심 KPI·성과 수치만 쉼표로 나열 (예: 92%, 2019년부터, 5회차). 페이지 번호·목차 번호·연도만 나열하지 마세요. 수치가 없으면 '포함된 수치가 없어요'.",
  "terms": "반복 사용되는 공식/브랜드 용어 (쉼표로 나열). 반드시 1자 이상 — 해당 용어가 없으면 '특별한 공식 용어 없음'이라고 쓰세요.",
  "audience": "대상 독자 추론",
  "risk": "과장·단정·미확인 주장 등 리스크 문장 감지 결과 한 문장. 리스크가 없으면 '특별한 리스크가 감지되지 않았어요'라고 쓰세요."
}

주의: 모든 필드는 빈 문자열("")이 될 수 없어요. 해당 내용이 없으면 위에 안내된 대체 문구를 그대로 사용하세요.

문서 텍스트:
"""
${text.slice(0, 12000)}
"""`;
}

export function buildGeneratePrompt(input: {
  issue: string;
  industry?: string | null;
  purpose?: string | null;
  targetAudience?: string | null;
  analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
  research?: ResearchResult | null;
  ragChunks?: RetrievedChunk[];
}): string {
  const contextBlock = [
    `주제: ${input.issue}`,
    `카테고리(도메인): ${input.industry ?? "미지정"}`,
    input.purpose ? `활용 목적: ${input.purpose}` : null,
    input.targetAudience ? `타겟 오디언스: ${input.targetAudience}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const analysesBlock = input.analyses
    .map(
      (a, i) =>
        `[문서 ${i + 1}: ${a.filename}]\n- 문서목적: ${a.analysis.docType}\n- 핵심주제: ${a.analysis.topic}\n- 핵심주장: ${a.analysis.claim}\n- 주요수치: ${a.analysis.numbers}\n- 공식용어: ${a.analysis.terms}\n- 대상독자: ${a.analysis.audience}\n- 리스크: ${a.analysis.risk}`,
    )
    .join("\n\n");

  return `아래는 메시지하우스 작성 맥락과 업로드된 문서들의 분석 결과입니다. 맥락을 반영해 메시지하우스 프레임워크를 아래 JSON 스키마에 맞게 자동 구성하세요.

[작성 맥락]
${contextBlock}${buildResearchBlock(input.research)}${buildRagBlock(input.ragChunks)}

[필수 준수 — 맥락 정합성]
- roofMessage·aieoSummary·각 pillar는 반드시 위 '주제(issue)'와 문서 분석 결과에서 확인 가능한 내용만 사용하세요.
- evidence·foundation·officialTerms는 문서 분석의 claim·numbers·terms·topic과 연결 가능해야 합니다.
- 각 pillar의 foundation을 먼저 작성한 뒤, message는 foundation의 근거·수치·사례를 바탕으로 주제(issue)의 기업명을 포함한 100자 이내 완전한 문장(~해요/~입니다)으로 작성하세요.
- 은/는·이/가·을/를 등 조사는 한국어 맞춤법에 맞게 자연스럽게 붙이세요. '을(를)' 같은 placeholder 표기는 쓰지 마세요.
- pillar message는 bullet·키워드 나열이 아니라 기업명 + 서술형 완결 문장이어야 합니다.
- objections·aieoSummary·riskFlags·roofMessage도 모두 자연스러운 한국어 완결 문장으로 작성하세요.
- 다른 기업/경쟁사 데모 문구(예: 특정 생명보험사 AI 언더라이팅 사례)를 그대로 복사하지 마세요.
- 주제에 없는 회사명·브랜드명·수치를 임의로 추가하지 마세요.

스키마:
{
  "roofMessage": "지붕 — 우산 메시지 1문장",
  "pillars": [
    {"id":"P1","theme":"기둥 1 테마","message":"{기업명}는 {근거/수치}를 담은 완전한 한 문장","evidence":"근거","foundation":"근거 문장 · 핵심 수치(설명 가능한 KPI) · 사례 문장","source":"file_extracted"},
    {"id":"P2","theme":"기둥 2 테마","message":"{기업명}는 {근거/수치}를 담은 완전한 한 문장","evidence":"근거","foundation":"근거 문장 · 핵심 수치(설명 가능한 KPI) · 사례 문장","source":"file_extracted"},
    {"id":"P3","theme":"기둥 3 테마","message":"{기업명}는 {근거/수치}를 담은 완전한 한 문장","evidence":"근거","foundation":"근거 문장 · 핵심 수치(설명 가능한 KPI) · 사례 문장","source":"file_extracted 또는 research_enhanced"}
  ],
  "foundation": "각 기둥 foundation(근거 · 수치 · 사례)을 가운뎃점(·)으로 이어 붙인 문자열",
  "objections": ["오해 방지 문장 1", "오해 방지 문장 2"],
  "aieoSummary": "AI 인용용 요약 2~3문장",
  "riskFlags": ["반드시 사람이 확인해야 할 리스크 문장들"],
  "forbiddenTerms": "금지 표현을 쉼표로 나열한 문자열 (반드시 1자 이상, 없으면 '특별히 금지할 표현 없음')",
  "officialTerms": "공식 용어를 쉼표로 나열한 문자열 (반드시 1자 이상, 없으면 '공식 용어 미확인')"
}

주의: forbiddenTerms와 officialTerms는 빈 문자열("")을 쓰지 마세요. 해당 항목이 없으면 위 안내 문구를 그대로 넣으세요.

문서 분석 결과:
${analysesBlock}`;
}
