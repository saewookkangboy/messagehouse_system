import { z } from "zod";
import type { ResearchResult } from "../research/schema";
import type { RetrievedChunk } from "../rag/schema";

export const DocumentAnalysisSchema = z.object({
  docType: z.string().min(1),
  topic: z.string().min(1),
  claim: z.string().min(1),
  numbers: z.string().min(1),
  terms: z.string().min(1),
  audience: z.string().min(1),
  risk: z.string().min(1),
});
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;

export const PillarSchema = z.object({
  id: z.string().min(1),
  theme: z.string().min(1),
  message: z.string().min(1),
  evidence: z.string().min(1),
  foundation: z.string().default(""),
  source: z.enum(["file_extracted", "research_enhanced"]),
});
export type Pillar = z.infer<typeof PillarSchema>;

/** AI가 빈 문자열·배열을 반환하는 경우가 있어 정규화합니다. */
function normalizeCommaSeparatedField(val: unknown, fallback: string): string {
  if (Array.isArray(val)) {
    const joined = val
      .map((item) => String(item).trim())
      .filter((s) => s.length > 0)
      .join(", ");
    return joined.length > 0 ? joined : fallback;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}

const CommaSeparatedTermsSchema = (fallback: string) =>
  z
    .union([z.string(), z.array(z.union([z.string(), z.number()]))])
    .transform((val) => normalizeCommaSeparatedField(val, fallback));

export const MessageHouseSchema = z.object({
  roofMessage: z.string().min(1),
  pillars: z.array(PillarSchema).length(3),
  foundation: z.string().min(1),
  objections: z.array(z.string().min(1)).min(1),
  aieoSummary: z.string().min(1),
  riskFlags: z.array(z.string().min(1)),
  forbiddenTerms: CommaSeparatedTermsSchema("특별히 금지할 표현 없음"),
  officialTerms: CommaSeparatedTermsSchema("공식 용어 미확인"),
});
export type MessageHouse = z.infer<typeof MessageHouseSchema>;

export interface AiProvider {
  analyzeDocument(input: {
    filename: string;
    text: string;
  }): Promise<DocumentAnalysis>;

  generateMessageHouse(input: {
    issue: string;
    industry?: string | null;
    purpose?: string | null;
    targetAudience?: string | null;
    analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
    research?: ResearchResult | null;
    ragChunks?: RetrievedChunk[];
  }): Promise<MessageHouse>;
}
