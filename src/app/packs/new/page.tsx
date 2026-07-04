"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import {
  analyzeContextPack,
  createContextPack,
  deleteFile,
  patchContextPack,
  uploadFiles,
  type SourceFile,
} from "@/lib/apiClient";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function NewContextPackPage() {
  const router = useRouter();
  const [packId, setPackId] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const [industry, setIndustry] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const packIdRef = useRef<string | null>(null);
  const packPromiseRef = useRef<Promise<string> | null>(null);

  // Visiting or reloading this page shouldn't create an empty draft pack —
  // only lazily create one on the first real action (upload, meta edit, or
  // starting analysis), memoized so concurrent callers share one creation.
  const ensurePack = useCallback((): Promise<string> => {
    if (packIdRef.current) return Promise.resolve(packIdRef.current);
    if (!packPromiseRef.current) {
      packPromiseRef.current = createContextPack()
        .then((res) => {
          packIdRef.current = res.contextPack.id;
          setPackId(res.contextPack.id);
          return res.contextPack.id;
        })
        .catch((e) => {
          packPromiseRef.current = null;
          throw e;
        });
    }
    return packPromiseRef.current;
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      try {
        const id = await ensurePack();
        const res = await uploadFiles(id, arr);
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
      }
    },
    [ensurePack],
  );

  async function handleRemove(fileId: string) {
    if (!packId) return;
    await deleteFile(packId, fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function saveMeta() {
    if (!issue.trim() && !industry.trim()) return;
    const id = await ensurePack();
    await patchContextPack(id, {
      issue: issue.trim() || undefined,
      industry: industry.trim() || null,
    }).catch(() => {});
  }

  async function startAnalysis() {
    if (files.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const id = await ensurePack();
      await saveMeta();
      await analyzeContextPack(id);
      router.push(`/packs/${id}/analysis`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석을 시작하지 못했어요.");
      setStarting(false);
    }
  }

  return (
    <>
      <Header subtitle="Step 1 · 파일 업로드" />
      <Stepper current="upload" />
      <main className="page" id="main-content">
        <div className="eyebrow">Step 1</div>
        <h1 className="page-title">파일을 업로드하세요</h1>
        <p className="page-desc">
          보도자료·발표자료·기획안 파일을 올리면 분석이 바로 시작돼요. 여러 파일을 한
          번에 올릴 수 있어요. .txt / .md / .pdf / .docx / .hwp / .hwpx 파일을
          지원해요.
        </p>

        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label
                htmlFor="issue"
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}
              >
                이슈명
              </label>
              <input
                id="issue"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                onBlur={saveMeta}
                placeholder="예: AI 언더라이팅 신상품 출시"
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "9px 12px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label
                htmlFor="industry"
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}
              >
                업종
              </label>
              <input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                onBlur={saveMeta}
                placeholder="예: 보험"
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "9px 12px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        </div>

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
          className={`dropzone${dragOver ? " dragover" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="클릭하거나 파일을 끌어다 놓아 업로드"
          onClick={() => fileInputRef.current?.click()}
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
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="dz-icon">
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 16V4M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </div>
          <div className="main">클릭하거나 파일을 끌어다 놓으세요</div>
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
