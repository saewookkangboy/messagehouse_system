import type { DocumentAnalysis, MessageHouse, Pillar } from "./schema";

export type MessageHouseValidationInput = {
  issue: string;
  industry?: string | null;
  analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
};

export type MessageHouseValidationIssue = {
  code: "issue_mismatch" | "demo_bias" | "ungrounded_pillar";
  message: string;
  pillarId?: string;
};

/** ponytail: 데모 시나리오 고정 문구 — issue·원문에 없으면 편향으로 간주 */
const DEMO_BIAS_MARKERS = [
  "한화생명",
  "스마트 언더라이팅",
  "AI 언더라이팅",
  "가입 시간 3일",
  "3일에서 10분",
  "10분으로 단축",
  "금감원 우수사례 2025",
  "ESG A등급 3년",
] as const;

const STOPWORDS = new Set([
  "및",
  "등",
  "위",
  "를",
  "을",
  "이",
  "가",
  "은",
  "는",
  "의",
  "에",
  "에서",
  "으로",
  "하고",
  "대한",
  "관련",
  "통해",
  "위해",
]);

export function extractSignificantTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[^\p{L}\p{N}]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
    ),
  ];
}

export function buildSourceCorpus(input: MessageHouseValidationInput): string {
  return [
    input.issue,
    input.industry ?? "",
    ...input.analyses.flatMap(({ filename, analysis }) => [
      filename,
      analysis.docType,
      analysis.topic,
      analysis.claim,
      analysis.numbers,
      analysis.terms,
      analysis.audience,
      analysis.risk,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function collectOutputText(house: MessageHouse): string {
  return [
    house.roofMessage,
    house.foundation,
    house.aieoSummary,
    house.forbiddenTerms,
    house.officialTerms,
    ...house.objections,
    ...house.riskFlags,
    ...house.pillars.flatMap((pillar) => [
      pillar.theme,
      pillar.message,
      pillar.evidence,
      pillar.foundation,
    ]),
  ].join("\n");
}

function containsAnyToken(text: string, tokens: string[]): boolean {
  const lowered = text.toLowerCase();
  return tokens.some((token) => lowered.includes(token.toLowerCase()));
}

function hasCorpusMarker(corpus: string, marker: string): boolean {
  return corpus.toLowerCase().includes(marker.toLowerCase());
}

function pillarGrounded(
  pillar: Pillar,
  input: MessageHouseValidationInput,
): boolean {
  const analyses = input.analyses;
  if (analyses.length === 0) return true;

  const pillarText = `${pillar.theme} ${pillar.message} ${pillar.evidence} ${pillar.foundation}`;
  const pillarTokens = extractSignificantTokens(pillarText);
  const corpusTokens = extractSignificantTokens(buildSourceCorpus(input));
  const sharedWithCorpus = pillarTokens.filter((token) => corpusTokens.includes(token));

  if (sharedWithCorpus.length >= 1) return true;

  const corpus = buildSourceCorpus(input);
  if (pillar.evidence.trim().length >= 6 && corpus.includes(pillar.evidence.slice(0, 8))) {
    return true;
  }

  return analyses.some(({ analysis }) => {
    const docText = `${analysis.topic} ${analysis.claim} ${analysis.terms} ${analysis.numbers}`;
    const docTokens = extractSignificantTokens(docText);
    return pillarTokens.some((token) => docTokens.includes(token));
  });
}

/** 생성 결과가 업로드 자료·주제(기업) 맥락과 맞는지 검수합니다. */
export function validateMessageHouseContext(
  house: MessageHouse,
  input: MessageHouseValidationInput,
): MessageHouseValidationIssue[] {
  const issues: MessageHouseValidationIssue[] = [];
  const corpus = buildSourceCorpus(input);
  const issueTokens = extractSignificantTokens(input.issue);
  const outputText = collectOutputText(house);

  if (
    issueTokens.length > 0 &&
    !containsAnyToken(`${house.roofMessage} ${house.aieoSummary}`, issueTokens)
  ) {
    issues.push({
      code: "issue_mismatch",
      message: `지붕·AIEO 요약에 주제 '${input.issue}'와 연결된 표현이 없어요. 기업/주제 맥락을 반영해주세요.`,
    });
  }

  for (const marker of DEMO_BIAS_MARKERS) {
    if (
      outputText.includes(marker) &&
      !hasCorpusMarker(corpus, marker) &&
      !input.issue.includes(marker)
    ) {
      issues.push({
        code: "demo_bias",
        message: `데모 템플릿 표현 '${marker}'이(가) 업로드 자료·주제와 무관하게 포함되어 있어요.`,
      });
    }
  }

  for (const pillar of house.pillars.filter((p) => p.source === "file_extracted")) {
    if (!pillarGrounded(pillar, input)) {
      issues.push({
        code: "ungrounded_pillar",
        pillarId: pillar.id,
        message: `기둥 ${pillar.id}(${pillar.theme})이 업로드 문서 분석 결과와 연결되지 않았어요.`,
      });
    }
  }

  return issues;
}

export function appendValidationRiskFlags(
  house: MessageHouse,
  validationIssues: MessageHouseValidationIssue[],
): MessageHouse {
  if (validationIssues.length === 0) return house;

  const flags = validationIssues.map((issue) => `[맥락 검수] ${issue.message}`);
  return {
    ...house,
    riskFlags: [...new Set([...house.riskFlags, ...flags])],
  };
}

export function formatValidationErrors(issues: MessageHouseValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}

export function hasHardValidationFailure(issues: MessageHouseValidationIssue[]): boolean {
  return issues.some((issue) => issue.code === "demo_bias" || issue.code === "issue_mismatch");
}
