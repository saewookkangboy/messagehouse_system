import {
  BGE_M3_KO_MODEL,
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from "./schema";
import { l2Normalize } from "./cosine";

const HF_INFERENCE_URL =
  "https://router.huggingface.co/hf-inference/models/dragonkue/BGE-m3-ko/pipeline/feature-extraction";

type HfFeatureResponse = number[] | number[][] | number[][][];

function flattenEmbedding(data: HfFeatureResponse): number[] {
  if (Array.isArray(data) && typeof data[0] === "number") {
    return data as number[];
  }
  if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === "number") {
    const matrix = data as number[][];
    const dim = matrix[0]?.length ?? EMBEDDING_DIMENSIONS;
    const pooled = new Array<number>(dim).fill(0);
    for (const row of matrix) {
      for (let i = 0; i < dim; i++) {
        pooled[i] = (pooled[i] ?? 0) + (row[i] ?? 0);
      }
    }
    return pooled.map((v) => v / matrix.length);
  }
  throw new Error("Hugging Face 임베딩 응답 형식을 인식하지 못했어요.");
}

/**
 * Korean-optimized BGE-M3 fine-tune via Hugging Face Inference API.
 * Kor-IR / Korean Embedding Benchmark에서 text-embedding-3-large 대비
 * 한국어 검색 정확도가 높아 메시지하우스 기본 임베딩으로 채택했어요.
 */
export class BgeM3KoEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = BGE_M3_KO_MODEL;
  private token: string;

  constructor(token = process.env.HF_TOKEN) {
    if (!token) {
      throw new Error(
        "HF_TOKEN이 설정되지 않았어요. .env에 토큰을 추가하거나 EMBEDDING_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.token = token;
  }

  private async request(text: string): Promise<number[]> {
    const res = await fetch(HF_INFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    });
    if (!res.ok) {
      throw new Error(
        `BGE-m3-ko 임베딩 요청이 실패했어요 (${res.status}). HF_TOKEN과 모델 접근 권한을 확인해주세요.`,
      );
    }
    const data = (await res.json()) as HfFeatureResponse;
    return l2Normalize(flattenEmbedding(data));
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      vectors.push(await this.request(text));
    }
    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.request(`Represent this sentence for searching relevant passages: ${text}`);
  }
}
