import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiResponseParseError, extractJsonBlock, parseAiJson } from "./parseAiJson";

describe("extractJsonBlock", () => {
  it("returns the raw text when there is no code fence", () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });

  it("strips a ```json fenced block", () => {
    const text = '이건 결과예요:\n```json\n{"a":1}\n```\n';
    expect(extractJsonBlock(text)).toBe('{"a":1}');
  });

  it("strips a plain ``` fenced block without a language tag", () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJsonBlock(text)).toBe('{"a":1}');
  });
});

const schema = z.object({ a: z.number() });

describe("parseAiJson", () => {
  it("parses and validates well-formed JSON", () => {
    expect(parseAiJson('{"a":1}', schema)).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    expect(parseAiJson('```json\n{"a":1}\n```', schema)).toEqual({ a: 1 });
  });

  it("throws AiResponseParseError on invalid JSON syntax", () => {
    expect(() => parseAiJson("not json", schema)).toThrow(AiResponseParseError);
  });

  it("throws AiResponseParseError when the JSON doesn't match the schema", () => {
    expect(() => parseAiJson('{"a":"not-a-number"}', schema)).toThrow(
      AiResponseParseError,
    );
  });
});
