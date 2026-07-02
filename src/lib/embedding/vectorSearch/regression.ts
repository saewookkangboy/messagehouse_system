import type { RetrievedChunk } from "@/lib/rag/schema";

export type ChunkIdentity = {
  filename: string;
  chunkIndex: number;
  text: string;
  source?: RetrievedChunk["source"];
};

export type RegressionDiffOptions = {
  /** 코사인 유사도 절대 오차 허용 (float 정밀도·pgvector 차이) */
  scoreTolerance?: number;
};

export type RegressionDiffResult = {
  ok: boolean;
  query: string;
  sqliteTopK: RetrievedChunk[];
  pgTopK: RetrievedChunk[];
  rankMismatches: Array<{
    rank: number;
    sqlite?: ChunkIdentity;
    pg?: ChunkIdentity;
  }>;
  scoreMismatches: Array<{
    identity: ChunkIdentity;
    sqliteScore?: number;
    pgScore?: number;
    delta: number;
  }>;
};

function identityKey(chunk: ChunkIdentity): string {
  return `${chunk.source ?? "pack"}::${chunk.filename}::${chunk.chunkIndex}`;
}

export function compareRetrievalResults(input: {
  query: string;
  sqlite: RetrievedChunk[];
  pg: RetrievedChunk[];
  options?: RegressionDiffOptions;
}): RegressionDiffResult {
  const tolerance = input.options?.scoreTolerance ?? 1e-4;
  const sqliteTopK = input.sqlite;
  const pgTopK = input.pg;

  const rankMismatches: RegressionDiffResult["rankMismatches"] = [];
  const maxRank = Math.max(sqliteTopK.length, pgTopK.length);

  for (let rank = 0; rank < maxRank; rank++) {
    const s = sqliteTopK[rank];
    const p = pgTopK[rank];
    if (!s && !p) continue;

    const same =
      s &&
      p &&
      s.filename === p.filename &&
      s.chunkIndex === p.chunkIndex &&
      s.text === p.text &&
      (s.source ?? "pack") === (p.source ?? "pack");

    if (!same) {
      rankMismatches.push({
        rank,
        sqlite: s
          ? {
              filename: s.filename,
              chunkIndex: s.chunkIndex,
              text: s.text,
              source: s.source,
            }
          : undefined,
        pg: p
          ? {
              filename: p.filename,
              chunkIndex: p.chunkIndex,
              text: p.text,
              source: p.source,
            }
          : undefined,
      });
    }
  }

  const pgByKey = new Map(pgTopK.map((c) => [identityKey(c), c]));
  const scoreMismatches: RegressionDiffResult["scoreMismatches"] = [];

  for (const s of sqliteTopK) {
    const key = identityKey(s);
    const p = pgByKey.get(key);
    if (!p) continue;
    const delta = Math.abs(s.score - p.score);
    if (delta > tolerance) {
      scoreMismatches.push({
        identity: {
          filename: s.filename,
          chunkIndex: s.chunkIndex,
          text: s.text,
          source: s.source,
        },
        sqliteScore: s.score,
        pgScore: p.score,
        delta,
      });
    }
  }

  return {
    ok: rankMismatches.length === 0 && scoreMismatches.length === 0,
    query: input.query,
    sqliteTopK,
    pgTopK,
    rankMismatches,
    scoreMismatches,
  };
}

export function formatRegressionReport(results: RegressionDiffResult[]): string {
  const lines: string[] = [];
  let pass = 0;
  let fail = 0;

  for (const r of results) {
    if (r.ok) {
      pass++;
      lines.push(`✓ "${r.query}" — Top-${r.sqliteTopK.length} 일치`);
    } else {
      fail++;
      lines.push(`✗ "${r.query}"`);
      for (const m of r.rankMismatches) {
        lines.push(
          `  rank ${m.rank}: sqlite=${m.sqlite?.filename ?? "-"} pg=${m.pg?.filename ?? "-"}`,
        );
      }
      for (const m of r.scoreMismatches) {
        lines.push(
          `  score Δ${m.delta.toExponential(2)} @ ${m.identity.filename}#${m.identity.chunkIndex}`,
        );
      }
    }
  }

  lines.unshift(`RAG regression: ${pass} passed, ${fail} failed`);
  return lines.join("\n");
}
