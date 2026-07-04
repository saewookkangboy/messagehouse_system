"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import {
  generateContextPack,
  getPipelineStatus,
  streamPipelineUrl,
  type ContextPack,
  type SourceFile,
} from "@/lib/apiClient";
import type { PipelineStatus, PipelineStep } from "@/lib/pipeline/schema";
import type { ResearchResult } from "@/lib/research/schema";
import { deserializeResearchResult } from "@/lib/contextPackSerialization";

const STEP_LABEL: Record<PipelineStep, string> = {
  upload: "업로드",
  analyze: "파일 분석",
  research: "자동 리서치",
  generate: "메시지하우스 생성",
  review: "검토",
  confirm: "확정",
  export: "보내기",
};

function PipelineProgress({ pipeline }: { pipeline: PipelineStatus | null }) {
  if (!pipeline) return null;
  const steps: PipelineStep[] = ["analyze", "research"];
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="doc-head">
        <div className="doc-name">파이프라인 진행</div>
      </div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
        {steps.map((step) => {
          const status = pipeline.steps[step];
          const label =
            status === "running"
              ? `${STEP_LABEL[step]} 중...`
              : status === "done"
                ? `${STEP_LABEL[step]} 완료`
                : status === "failed"
                  ? `${STEP_LABEL[step]} 실패`
                  : `${STEP_LABEL[step]} 대기`;
          return (
            <li
              key={step}
              style={{
                marginBottom: 4,
                color: status === "running" ? "var(--accent)" : "inherit",
              }}
            >
              {label}
            </li>
          );
        })}
      </ol>
      {pipeline.error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{pipeline.error}</p>
      )}
    </div>
  );
}

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [pack, setPack] = useState<ContextPack | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pipelineStarted = useRef(false);

  const syncFinalState = useCallback(async () => {
    try {
      const status = await getPipelineStatus(id);
      setPipeline(status.pipeline);
      setPack(status.contextPack);
      setFiles(status.contextPack.files);
      if (status.contextPack.researchResult) {
        setResearch(deserializeResearchResult(status.contextPack.researchResult));
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  // SSE 스트림으로 파이프라인을 실행하며 단계별 진행을 실시간 반영해요.
  const runWithStream = useCallback(
    (options: { force?: boolean }) =>
      new Promise<void>((resolve) => {
        const url =
          streamPipelineUrl(id, { target: "researched" }) +
          (options.force ? "&force=true" : "");
        const es = new EventSource(url);
        let settled = false;

        const finish = async () => {
          if (settled) return;
          settled = true;
          es.close();
          await syncFinalState();
          resolve();
        };

        es.addEventListener("step_start", (e) => {
          const d = JSON.parse((e as MessageEvent).data) as { step: PipelineStep };
          // 해당 단계를 즉시 running으로 표시(낙관적)
          setPipeline((prev) =>
            prev
              ? { ...prev, runningStep: d.step, steps: { ...prev.steps, [d.step]: "running" } }
              : prev,
          );
        });
        es.addEventListener("status", (e) => {
          const d = JSON.parse((e as MessageEvent).data) as { pipeline: PipelineStatus };
          setPipeline(d.pipeline);
        });
        es.addEventListener("done", (e) => {
          const d = JSON.parse((e as MessageEvent).data) as { pipeline: PipelineStatus };
          setPipeline(d.pipeline);
          void finish();
        });
        es.addEventListener("error", (e) => {
          // 서버가 보낸 error 이벤트는 data가 있어요. 연결 오류(native)는 data가 없어요.
          const data = (e as MessageEvent).data;
          if (data) {
            try {
              const d = JSON.parse(data) as { message?: string };
              setError(d.message ?? "분석 중 오류가 발생했어요.");
            } catch {
              setError("분석 중 오류가 발생했어요.");
            }
          }
          void finish();
        });
      }),
    [id, syncFinalState],
  );

  useEffect(() => {
    if (pipelineStarted.current) return;
    pipelineStarted.current = true;
    runWithStream({}).finally(() => setLoading(false));
  }, [runWithStream]);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    await runWithStream({ force: true });
    setRetrying(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateContextPack(id);
      router.push(`/packs/${id}/review`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "메시지하우스 생성에 실패했어요.");
      setGenerating(false);
    }
  }

  const allAnalyzed = files.length > 0 && files.every((f) => f.analyzedAt);
  const researching = pipeline?.runningStep === "research";

  return (
    <>
      <Header subtitle="Step 2 · 파일 분석 결과" />
      <main className="page" id="main-content">
        <div className="eyebrow">Step 2 결과 · F-02</div>
        <h1 className="page-title">파일 분석 요약 카드</h1>
        <p className="page-desc">
          업로드한 문서마다 핵심 주제·주장·수치·용어·리스크를 자동으로 뽑아 카드로
          정리했어요.
        </p>

        {(loading || pipeline?.runningStep || pipeline?.error) && (
          <PipelineProgress pipeline={pipeline} />
        )}

        {pipeline?.error && !loading && (
          <div className="btn-row" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={retrying}
              onClick={handleRetry}
            >
              {retrying ? "다시 시도하는 중..." : "분석 다시 시도하기"}
            </button>
          </div>
        )}

        {loading && !pipeline && (
          <div className="callout">
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3l9 5-9 5-9-5 9-5z" />
              <path d="M3 13l9 5 9-5" />
            </svg>
            <span>파일을 분석하고 있어요. 잠시만 기다려주세요...</span>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        {!loading &&
          files.map((f) => (
            <div className="card" key={f.id}>
              <div className="doc-head">
                <div className="doc-name">
                  <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M6 3h8l4 4v14H6z" />
                    <path d="M14 3v4h4" />
                  </svg>
                  {f.filename}
                </div>
                {f.docType && <span className="tag">{f.docType}</span>}
              </div>
              {f.analyzedAt ? (
                <div className="table-scroll">
                  <table className="kv">
                    <tbody>
                      <tr>
                        <td>핵심 주제</td>
                        <td>{f.topic}</td>
                      </tr>
                      <tr>
                        <td>핵심 주장</td>
                        <td>{f.claim}</td>
                      </tr>
                      <tr>
                        <td>주요 수치</td>
                        <td className="tnum">{f.numbers}</td>
                      </tr>
                      <tr>
                        <td>공식 용어</td>
                        <td>{f.terms}</td>
                      </tr>
                      <tr>
                        <td>대상 독자</td>
                        <td>{f.audience}</td>
                      </tr>
                      <tr>
                        <td>리스크 감지</td>
                        <td>
                          <span className="risk-text">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 3L2 21h20L12 3z" />
                              <path d="M12 10v5M12 18h.01" />
                            </svg>
                            {f.risk}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>분석 대기중...</div>
              )}
            </div>
          ))}

        {!loading && researching && (
          <div className="callout">
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3l9 5-9 5-9-5 9-5z" />
              <path d="M3 13l9 5 9-5" />
            </svg>
            <span>관련 뉴스·업계 트렌드·경쟁사 동향을 자동으로 리서치하고 있어요...</span>
          </div>
        )}

        {!loading && research && (
          <div className="card">
            <div className="doc-head">
              <div className="doc-name">
                <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                자동 리서치 결과
              </div>
              <span className="tag">F-03</span>
            </div>
            <div className="table-scroll">
              <table className="kv">
                <tbody>
                  <tr>
                    <td>최신 뉴스</td>
                    <td>{research.news.join(" · ")}</td>
                  </tr>
                  <tr>
                    <td>업계 트렌드</td>
                    <td>{research.industryTrends.join(" · ")}</td>
                  </tr>
                  <tr>
                    <td>경쟁사 동향</td>
                    <td>{research.competitorMoves.join(" · ")}</td>
                  </tr>
                  <tr>
                    <td>규제·정책</td>
                    <td>{research.regulations.join(" · ")}</td>
                  </tr>
                  <tr>
                    <td>AIEO 키워드</td>
                    <td>{research.aieoKeywords.join(", ")}</td>
                  </tr>
                  <tr>
                    <td>차별화 포인트</td>
                    <td>{research.differentiationPoint}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!allAnalyzed || !!researching || generating || loading}
            onClick={handleGenerate}
          >
            {generating ? "메시지하우스 생성 중..." : "메시지하우스 생성"}
          </button>
        </div>

        {pack?.roofMessage && (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
            이미 생성된 메시지하우스가 있어요. 다시 생성하면 기존 내용을 덮어써요.
          </p>
        )}
      </main>
    </>
  );
}
