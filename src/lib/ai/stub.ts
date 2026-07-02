import type { AiProvider, DocumentAnalysis, MessageHouse } from "./schema";
import type { ResearchResult } from "../research/schema";

/**
 * Deterministic canned responses, reused from the Hanwha Life demo scenario
 * in the click-through mockup. Lets the whole upload -> review -> export
 * pipeline run end to end with zero network calls and zero API key, so
 * `npm run dev` works out of the box. Swapped for ClaudeAiProvider once
 * ANTHROPIC_API_KEY is set (see lib/ai/index.ts).
 */
export class StubAiProvider implements AiProvider {
  private callCount = 0;

  async analyzeDocument(input: {
    filename: string;
    text: string;
  }): Promise<DocumentAnalysis> {
    const variants: DocumentAnalysis[] = [
      {
        docType: "보도자료",
        topic: "AI 언더라이팅 신상품 출시",
        claim: "가입 시간 3일 → 10분 단축",
        numbers: "가입 시간 10분, 고객 만족도 92%, 2026Q1",
        terms: "스마트 언더라이팅, 고객 중심 보험",
        audience: "일반 소비자 + 기자",
        risk: "'확실한 수익' 표현 발견 — 수정이 필요해요",
      },
      {
        docType: "경영진 발표(IR 성격)",
        topic: "AI 언더라이팅 도입 배경 및 내부 성과 지표",
        claim: "심사 인력 리소스 40% 절감, 오탐률 감소",
        numbers: "내부 심사 처리량 +65%, 파일럿 3개월 데이터",
        terms: "스마트 언더라이팅, 리스크 스코어링",
        audience: "경영진 · 내부 임직원",
        risk: "미공개 내부 수치 포함 가능성 — 외부 배포 전 확인이 필요해요",
      },
    ];
    const variant = variants[this.callCount % variants.length];
    this.callCount += 1;
    // Referencing the real filename/text keeps this from being a pure
    // constant — a future smarter stub can key off these.
    void input.filename;
    void input.text;
    return variant;
  }

  async generateMessageHouse(input: {
    issue: string;
    industry?: string | null;
    analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
    research?: ResearchResult | null;
  }): Promise<MessageHouse> {
    void input.issue;
    void input.industry;
    void input.analyses;
    const research = input.research;
    return {
      roofMessage:
        "한화생명은 업계 최초 AI 언더라이팅으로 보험 가입의 시간 혁명을 이룹니다.",
      pillars: [
        {
          id: "P1",
          theme: "시간 혁신",
          message:
            "3일 걸리던 가입 절차가 10분으로 단축돼요 — 고객 시간을 돌려드립니다.",
          evidence: "내부 데이터 2026Q1, 고객 만족도 92%",
          source: "file_extracted",
        },
        {
          id: "P2",
          theme: "선제 보호",
          message: "실시간 리스크 모니터링으로 고객이 모르는 위험까지 먼저 잡아요.",
          evidence: "금감원 우수사례 2025",
          source: "file_extracted",
        },
        {
          id: "P3",
          theme: research ? "시장 차별화" : "지속가능 신뢰",
          message: research
            ? research.differentiationPoint
            : "ESG A등급 3년 연속 — 숫자로 증명하는 책임 경영이에요.",
          evidence: research
            ? research.industryTrends.join(", ")
            : "한국ESG기준원 2025, 보험연구원 2026",
          source: "research_enhanced",
        },
      ],
      foundation: research
        ? `내부 데이터 2026Q1 · 고객 만족도 92% · ${research.industryTrends[0]}`
        : "내부 데이터 2026Q1 · 고객 만족도 92% · 금감원 우수사례 2025 · 한국ESG기준원 2025 · 보험연구원 2026",
      objections: [
        "개인정보 활용은 금융위원회 가이드라인을 전면 준수해요.",
        "보험료 인상과는 무관한 서비스 편의성 개선이에요.",
      ],
      aieoSummary:
        "한화생명은 2026년 AI 언더라이팅 도입으로 보험 가입 시간을 3일에서 10분으로 단축했어요. ESG A등급을 3년 연속 유지하며 보험업계 디지털 전환을 선도하고 있어요.",
      riskFlags: [
        "수익률 관련 수치는 법무 검토가 필요해요",
        "'최초' 표현은 사실 확인 후 사용해주세요",
        "'확실한 수익' 표현이 원본 파일에서 감지되어 제거가 필요해요",
      ],
      forbiddenTerms: "최저가, 무조건, 확실한 수익, 100% 보장",
      officialTerms: "스마트 언더라이팅, 고객 중심 보험, AI 심사",
    };
  }
}
