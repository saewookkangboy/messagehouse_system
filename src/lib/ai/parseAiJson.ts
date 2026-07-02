import type { ZodType } from "zod";

export class AiResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResponseParseError";
  }
}

/**
 * Claude often wraps JSON answers in a ```json fenced block even when asked
 * not to. Strip the fence so downstream JSON.parse works either way.
 */
export function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export function parseAiJson<T>(text: string, schema: ZodType<T>): T {
  const jsonText = extractJsonBlock(text);

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new AiResponseParseError(
      `AI 응답을 JSON으로 파싱하지 못했어요: ${(err as Error).message}`,
    );
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AiResponseParseError(
      `AI 응답이 예상 스키마와 달라요: ${result.error.message}`,
    );
  }
  return result.data;
}
