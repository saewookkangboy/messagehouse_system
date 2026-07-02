import { GoogleGenAI } from "@google/genai";
import {
  DocumentAnalysisSchema,
  MessageHouseSchema,
  type AiProvider,
  type DocumentAnalysis,
  type MessageHouse,
} from "./schema";
import { parseAiJson } from "./parseAiJson";
import { SYSTEM_PROMPT, buildAnalyzePrompt, buildGeneratePrompt } from "./prompts";
import type { ResearchResult } from "../research/schema";

const MODEL = "gemini-2.5-flash";

export class GeminiAiProvider implements AiProvider {
  private client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY가 설정되지 않았어요. .env에 키를 추가하거나 AI_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  private async complete(userPrompt: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: { systemInstruction: SYSTEM_PROMPT },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Gemini 응답에서 텍스트를 찾지 못했어요.");
    }
    return text;
  }

  async analyzeDocument(input: {
    filename: string;
    text: string;
  }): Promise<DocumentAnalysis> {
    const raw = await this.complete(buildAnalyzePrompt(input.filename, input.text));
    return parseAiJson(raw, DocumentAnalysisSchema);
  }

  async generateMessageHouse(input: {
    issue: string;
    industry?: string | null;
    analyses: Array<{ filename: string; analysis: DocumentAnalysis }>;
    research?: ResearchResult | null;
  }): Promise<MessageHouse> {
    const raw = await this.complete(buildGeneratePrompt(input));
    return parseAiJson(raw, MessageHouseSchema);
  }
}
