"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import {
  analyzeContextPack,
  deleteFile,
  getContextPack,
  uploadFiles,
  type SourceFile,
} from "@/lib/apiClient";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: packId } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<{
    issue: string;
    industry: string | null;
    purpose: string | null;
    targetAudience: string | null;
  } | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getContextPack(packId)
      .then((res) => {
        setSummary({
          issue: res.contextPack.issue,
          industry: res.contextPack.industry,
          purpose: res.contextPack.purpose,
          targetAudience: res.contextPack.targetAudience,
        });
        setFiles(res.contextPack.files);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Context Pack을 불러오지 못했어요.");
      })
      .finally(() => setLoading(false));
  }, [packId]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0 || uploading) return;
      setUploading(true);
      setWarning(null);
      try {
        const res = await uploadFiles(packId, arr);
        setFiles((prev) => [...prev, ...res.files]);
        setWarning(
          res.errors.length
            ? `일부 파일을 추가하지 못했어요: ${res.errors
                .map((e) => `${e.filename} (${e.message})`)
                .join(", ")}`
            : null,
        );
      } catch (e) {
        setWarning(e instanceof Error ? e.message : "파일 업로드 중 오류가 발생했어요.");
      } finally {
        setUploading(false);
      }
    },
    [packId, uploading],
  );

  async function handleRemove(fileId: string) {
    await deleteFile(packId, fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function startAnalysis() {
    if (files.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      await analyzeContextPack(packId);
      router.push(`/packs/${packId}/analysis`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석을 시작하지 못했어요.");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header subtitle="Step 2 · 파일 업로드" />
        <Stepper current="upload" />
        <main className="page" id="main-content">
          <p className="page-desc">불러오는 중...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header subtitle="Step 2 · 파일 업로드" />
      <Stepper current="upload" />
      <main className="page" id="main-content">
        <div className="eyebrow">Step 2</div>
        <h1 className="page-title">파일을 업로드하세요</h1>
        <p className="page-desc">
          보도자료·발표자료·기획안 파일을 올리면 분석이 바로 시작돼요. 여러 파일을 한
          번에 올릴 수 있어요. .txt / .md / .pdf / .docx / .hwp / .hwpx 파일을
          지원해요.
        </p>

        {summary && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
              입력한 기본 정보
            </div>
            <dl style={{ display: "grid", gap: 8, margin: 0, fontSize: 13 }}>
              <div>
                <dt style={{ color: "var(--muted)", fontSize: 12 }}>주제</dt>
                <dd style={{ margin: "2px 0 0" }}>{summary.issue}</dd>
              </div>
              {summary.industry && (
                <div>
                  <dt style={{ color: "var(--muted)", fontSize: 12 }}>카테고리(도메인)</dt>
                  <dd style={{ margin: "2px 0 0" }}>{summary.industry}</dd>
                </div>
              )}
              {summary.purpose && (
                <div>
                  <dt style={{ color: "var(--muted)", fontSize: 12 }}>활용 목적</dt>
                  <dd style={{ margin: "2px 0 0" }}>{summary.purpose}</dd>
                </div>
              )}
              {summary.targetAudience && (
                <div>
                  <dt style={{ color: "var(--muted)", fontSize: 12 }}>타겟 오디언스</dt>
                  <dd style={{ margin: "2px 0 0" }}>{summary.targetAudience}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.pdf,.docx,.hwp,.hwpx"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          className={`dropzone${dragOver ? " dragover" : ""}${uploading ? " disabled" : ""}`}
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-busy={uploading}
          aria-label={uploading ? "파일 업로드 중" : "클릭하거나 파일을 끌어다 놓아 업로드"}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!uploading && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="dz-icon">
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 16V4M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </div>
          <div className="main">
            {uploading ? "업로드 중..." : "클릭하거나 파일을 끌어다 놓으세요"}
          </div>
          <div className="sub">파일 최대 10개 · 총 50 MB 이하</div>
          <div className="filetypes">
            <span className="filetype-chip">.txt</span>
            <span className="filetype-chip">.md</span>
            <span className="filetype-chip">.pdf</span>
            <span className="filetype-chip">.docx</span>
            <span className="filetype-chip">.hwp</span>
            <span className="filetype-chip">.hwpx</span>
          </div>
        </div>

        {warning && <div className="upload-warning">{warning}</div>}

        <div className="filelist">
          {files.map((f) => (
            <div className="fileitem" key={f.id}>
              <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M14 3v4h4" />
              </svg>
              <div className="fname">{f.filename}</div>
              <div className="fmeta tnum">{formatBytes(f.sizeBytes)}</div>
              <button
                type="button"
                className="fremove"
                aria-label={`${f.filename} 삭제`}
                onClick={() => handleRemove(f.id)}
              >
                <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="note-box">
          <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>
            업로드한 파일 텍스트는 Context Pack 저장에만 사용돼요. 미공개 정보가 포함된
            파일은 업로드 전에 다시 한번 확인해주세요.
          </span>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={files.length === 0 || starting}
            onClick={startAnalysis}
          >
            {starting ? "분석 시작 중..." : "분석 시작"}
          </button>
        </div>
      </main>
    </>
  );
}
