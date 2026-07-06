import type { AiProvider, DocumentAnalysis, MessageHouse, Pillar } from "./schema";
import type { ResearchResult } from "../research/schema";
import { composeConcisePillarMessage } from "../pillarMessage";
import { refineNaturalMessageHouse } from "../messageHouseSentence";

function firstMeaningfulLine(text: string): string {
  return (
    text
      .split(/\n/)
      .map((line) => line.trim())
      .find((line) => line.length >= 8) ?? ""
  );
}

function extractNumbersFromText(text: string): string {
  const matches = [
    ...text.matchAll(/\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\d{4}년[^\s,.]{0,16}/g),
    ...text.matchAll(/\d+(?:,\d{3})+(?:\.\d+)?(?:%|명|건|배|회|등급|위|개)?/g),
  ].map((match) => match[0]);

  const unique = [...new Set(matches.map((value) => value.trim()))].filter(Boolean);
  return unique.slice(0, 5).join(", ");
}

function inferDocType(filename: string): string {
  if (/보도|press|release/i.test(filename)) return "보도자료";
  if (/esg|지속가능|sustainability/i.test(filename)) return "지속가능경영보고서";
  if (/ir|investor/i.test(filename)) return "IR 자료";
  return "업로드 문서";
}

function buildPillarFromAnalysis(
  id: string,
  subject: string,
  analysis: DocumentAnalysis,
  source: Pillar["source"],
): Pillar {
  const numbers = analysis.numbers.includes("없어")
    ? analysis.claim
    : analysis.numbers;
  const foundation = `${analysis.claim || analysis.topic} · ${numbers || analysis.topic} · ${analysis.topic} 사례`;

  return {
    id,
    theme: analysis.topic.slice(0, 24) || "핵심 주제",
    message: composeConcisePillarMessage(
      [analysis.claim || analysis.topic, numbers || "", `${analysis.topic} 사례`],
      subject,
    ),
    evidence: analysis.claim || analysis.topic,
    foundation,
    source,
  };
}

/**
 * 입력 issue·업로드 분석 결과에서 메시지하우스를 조합합니다.
 * 고정 데모 문구(한화생명 등)를 쓰지 않아, 기업명을 바꿔도 결과가 함께 바뀝니다.
 */
export class StubAiProvider implements AiProvider {
  async analyzeDocument(input: {
    filename: string;
    text: string;
  }): Promise<DocumentAnalysis> {
    const text = input.text.trim();
    const lead = firstMeaningfulLine(text);
    const numbers = extractNumbersFromText(text);

    return {
      docType: inferDocType(input.filename),
      topic: lead.slice(0, 80) || input.filename.replace(/\.[^.]+$/, ""),
      claim: lead.slice(0, 140) || `${input.filename}에서 확인된 핵심 주장`,
      numbers: numbers || "포함된 수치가 없어요",
      terms: input.filename.replace(/\.[^.]+$/, "") || "특별한 공식 용어 없음",
      audience: "문서 독자",
      risk: /확실|무조건|100%|최초/.test(text)
        ? "과장·단정 표현이 감지되어 확인이 필요해요"
        : "특별한 리스크가 감지되지 않았어요",
    };
  }

  async generateMessageHouse(input: {
    issue: string;
    industry?: string | null;
    analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
    research?: ResearchResult | null;
  }): Promise<MessageHouse> {
    const subject = input.issue.trim() || "해당 주제";
    const industry = input.industry?.trim();
    const analyses =
      input.analyses.length > 0
        ? input.analyses
        : [
            {
              filename: "context.txt",
              analysis: {
                docType: "작성 맥락",
                topic: subject,
                claim: `${subject} 핵심 메시지`,
                numbers: "포함된 수치가 없어요",
                terms: subject,
                audience: "대상 독자",
                risk: "특별한 리스크가 감지되지 않았어요",
              },
            },
          ];

    const research = input.research;
    const pick = (index: number) => analyses[index % analyses.length].analysis;
    const terms = analyses
      .flatMap(({ analysis }) => analysis.terms.split(/[,·]/))
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");

    const pillars: Pillar[] = [
      buildPillarFromAnalysis("P1", subject, pick(0), "file_extracted"),
      buildPillarFromAnalysis("P2", subject, pick(1), "file_extracted"),
      research
        ? (() => {
            const foundation = `${research.differentiationPoint} · ${research.industryTrends[0] ?? subject} · ${research.news[0] ?? "시장 사례"}`;
            return {
              id: "P3",
              theme: "시장 맥락",
              message: composeConcisePillarMessage(
                [
                  research.differentiationPoint,
                  research.industryTrends[0] ?? "",
                  research.news[0] ?? "시장 사례",
                ],
                subject,
              ),
              evidence: research.industryTrends.join(", "),
              foundation,
              source: "research_enhanced" as const,
            };
          })()
        : buildPillarFromAnalysis("P3", subject, pick(2), "file_extracted"),
    ];

    const roofLead = pick(0).claim || pick(0).topic;
    const risks = analyses
      .map(({ analysis }) => analysis.risk)
      .filter((risk) => !risk.includes("감지되지 않았"));

    return refineNaturalMessageHouse(
      {
        roofMessage: roofLead,
        pillars,
        foundation: joinFoundations(pillars),
        objections: [],
        aieoSummary: "",
        riskFlags:
          risks.length > 0
            ? risks
            : ["AI가 생성한 수치·표현은 원본 문서와 대조해 확인해주세요."],
        forbiddenTerms: "최저가, 무조건, 100% 보장",
        officialTerms: terms || subject,
      },
      subject,
      industry,
    );
  }
}

function joinFoundations(pillars: Pillar[]): string {
  return pillars
    .map((pillar) => pillar.foundation)
    .filter(Boolean)
    .join(" · ");
}
