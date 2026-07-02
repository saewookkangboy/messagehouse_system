import type { Pillar } from "./ai/schema";

export interface ExportablePack {
  issue: string;
  industry: string | null;
  version: string;
  roofMessage: string;
  pillars: Pillar[];
  foundation: string;
  objections: string[];
  aieoSummary: string;
  riskFlags: string[];
  forbiddenTerms: string;
  officialTerms: string;
}

export function toExportJson(pack: ExportablePack): string {
  return JSON.stringify(
    {
      context_pack: {
        version: pack.version,
        issue: pack.issue,
        industry: pack.industry ?? undefined,
        roof_message: pack.roofMessage,
        foundation: pack.foundation,
        pillars: pack.pillars.map((p) => ({
          id: p.id,
          theme: p.theme,
          message: p.message,
          evidence: p.evidence,
          source: p.source,
        })),
        objections: pack.objections,
        aieo_summary: pack.aieoSummary,
        risk_flags: pack.riskFlags,
        forbidden_terms: pack.forbiddenTerms,
        official_terms: pack.officialTerms,
      },
    },
    null,
    2,
  );
}

export function toExportMarkdown(pack: ExportablePack): string {
  const pillarLines = pack.pillars
    .map((p, i) => `${i + 1}. ${p.theme} — ${p.message}`)
    .join("\n");
  const objectionLines = pack.objections.map((o) => `- ${o}`).join("\n");
  const riskLines = pack.riskFlags.map((r) => `- ${r}`).join("\n");

  return `# ${pack.issue} — Context Pack v${pack.version}

## 지붕
${pack.roofMessage}

## 기둥
${pillarLines}

## 기반
${pack.foundation}

## 빈 탄 (오해 방지)
${objectionLines}

## AIEO 요약
${pack.aieoSummary}

## Risk Flags
${riskLines}

## 금지 표현
${pack.forbiddenTerms}

## 공식 용어
${pack.officialTerms}`;
}

export function toExportClaudePrompt(pack: ExportablePack): string {
  const pillarLines = pack.pillars
    .map((p, i) => `- 기둥 ${i + 1} (${p.theme}): ${p.message}`)
    .join("\n");

  return `당신은 ${pack.issue} 관련 홍보팀의 메시지하우스를 기준으로 글을 쓰는 PR 어시스턴트입니다.

[핵심 메시지]
- 우산 메시지: ${pack.roofMessage}
${pillarLines}

[기반 메시지]
${pack.foundation}

[AIEO 관점]
${pack.aieoSummary}

[빈 탄 — 오해 방지]
${pack.objections.map((o) => `- ${o}`).join("\n")}

[Risk Flags]
${pack.riskFlags.map((r) => `- ${r}`).join("\n")}

[금지 표현]
${pack.forbiddenTerms}

[공식 용어]
${pack.officialTerms}

이 기준을 벗어나지 않는 범위에서 요청받은 문서를 작성해주세요.`;
}
