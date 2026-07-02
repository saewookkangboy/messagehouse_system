import { OPENAI_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "./schema";

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * OpenAI text-embedding-3-large — strong multilingual fallback when HF is
 * unavailable. Dimensions are reduced to 1024 (Matryoshka) to match BGE-m3-ko
 * storage and keep cosine comparisons consistent across providers.
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = OPENAI_EMBEDDING_MODEL;
  private apiKey: string;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY가 설정되지 않았어요. .env에 키를 추가하거나 EMBEDDING_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.apiKey = apiKey;
  }

  private async request(inputs: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI 임베딩 요청이 실패했어요 (${res.status}).`);
    }
    const data = (await res.json()) as OpenAiEmbeddingResponse;
    return data.data.map((row) => row.embedding);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.request(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.request([text]);
    if (!vector) {
      throw new Error("OpenAI 임베딩 응답이 비어 있어요.");
    }
    return vector;
  }
}
