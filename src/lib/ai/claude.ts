import Anthropic from "@anthropic-ai/sdk";
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

const MODEL = "claude-sonnet-5";

export class ClaudeAiProvider implements AiProvider {
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY가 설정되지 않았어요. .env에 키를 추가하거나 AI_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  private async complete(userPrompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude 응답에서 텍스트 블록을 찾지 못했어요.");
    }
    return textBlock.text;
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
