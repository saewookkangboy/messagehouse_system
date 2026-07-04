"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import {
  exportToDestination,
  getContextPack,
  getExport,
  getExportDestinations,
  getIntegrations,
  type ExportDestinationRow,
} from "@/lib/apiClient";

type Format = "json" | "markdown" | "claude";

const TABS: { key: Format; label: string }[] = [
  { key: "json", label: "JSON" },
  { key: "markdown", label: "Markdown" },
  { key: "claude", label: "Claude 시스템 프롬프트" },
];

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [active, setActive] = useState<Format>("json");
  const [texts, setTexts] = useState<Partial<Record<Format, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [packStatus, setPackStatus] = useState<string | null>(null);
  const [integrationsReady, setIntegrationsReady] = useState(false);
  const [destinations, setDestinations] = useState<ExportDestinationRow[]>([]);
  const [exporting, setExporting] = useState<"google_drive" | "notion" | null>(null);
  const [destinationMessage, setDestinationMessage] = useState<string | null>(null);

  const isConfirmed = packStatus === "confirmed";

  useEffect(() => {
    getContextPack(id)
      .then((res) => setPackStatus(res.contextPack.status))
      .catch(() => {});
    getIntegrations()
      .then((res) => setIntegrationsReady(!res.authRequired))
      .catch(() => {});
    getExportDestinations(id)
      .then((res) => setDestinations(res.destinations))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (texts[active]) return;
    getExport(id, active)
      .then((res) => setTexts((prev) => ({ ...prev, [active]: res.text })))
      .catch((e) => setError(e.message));
  }, [id, active, texts]);

  async function handleCopy() {
    const text = texts[active];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function handleDestinationExport(provider: "google_drive" | "notion") {
    setDestinationMessage(null);
    setExporting(provider);
    try {
      const format = active === "json" ? "json" : "markdown";
      const res = await exportToDestination(id, { provider, format });
      setDestinationMessage(
        res.updated
          ? `${provider === "google_drive" ? "Google Drive" : "Notion"} 파일이 업데이트되었어요.`
          : `${provider === "google_drive" ? "Google Drive" : "Notion"}에 저장되었어요.`,
      );
      const destRes = await getExportDestinations(id);
      setDestinations(destRes.destinations);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDestinationMessage(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <Header subtitle="Export" />
      <Stepper current="export" />
      <main className="page" id="main-content">
        <div className="eyebrow">Export</div>
        <h1 className="page-title">Context Pack 보내기</h1>
        <p className="page-desc">
          확정된 Context Pack을 원하는 형식으로 보내 다른 Agent나 문서 작성에 바로
          활용하세요. Notion·Google Drive 저장은 확정 후에만 가능해요.
        </p>

        {packStatus && !isConfirmed && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            아직 확정되지 않은 Pack이에요.{" "}
            <Link href={`/packs/${id}/review`}>검토 화면에서 확정</Link>한 뒤 외부 저장을
            사용할 수 있어요.
          </div>
        )}

        {error && (
          <div className="error-box">
            {error} — <Link href={`/packs/${id}/review`}>검토 화면으로 돌아가기</Link>
          </div>
        )}

        {!error && (
          <>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active === t.key}
                  className={`tab${active === t.key ? " active" : ""}`}
                  onClick={() => setActive(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="code-block mono">
              <button type="button" className="copy-btn" onClick={handleCopy}>
                <svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" strokeWidth="1.75" fill="none">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <rect x="3" y="3" width="12" height="12" rx="2" />
                </svg>
                {copied ? "복사됨" : "복사"}
              </button>
              {texts[active] ?? "불러오는 중..."}
            </div>

            {integrationsReady && isConfirmed && active !== "claude" && (
              <div className="card" style={{ marginTop: 20 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>외부 저장</h2>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                  {active === "json" ? "JSON" : "Markdown"} 형식으로 저장해요. 먼저{" "}
                  <Link href="/settings/integrations">연동 설정</Link>에서 OAuth 연결과 저장
                  위치를 지정해주세요.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={exporting !== null}
                    onClick={() => handleDestinationExport("google_drive")}
                  >
                    {exporting === "google_drive" ? "저장 중..." : "Google Drive에 저장"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={exporting !== null}
                    onClick={() => handleDestinationExport("notion")}
                  >
                    {exporting === "notion" ? "저장 중..." : "Notion에 저장"}
                  </button>
                </div>
                {destinationMessage && (
                  <p style={{ fontSize: 13, marginTop: 12 }}>{destinationMessage}</p>
                )}
                {destinations.length > 0 && (
                  <ul style={{ fontSize: 13, marginTop: 12, paddingLeft: 18 }}>
                    {destinations.map((d) => (
                      <li key={d.provider}>
                        {d.provider === "google_drive" ? "Google Drive" : "Notion"} ·{" "}
                        <a href={d.url} target="_blank" rel="noopener noreferrer">
                          열기
                        </a>{" "}
                        ({new Date(d.updatedAt).toLocaleString("ko-KR")})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {integrationsReady && isConfirmed && active === "claude" && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
                Claude 프롬프트는 복사하여 사용하세요. Notion·Drive 저장은 JSON/Markdown 탭에서
                가능해요.
              </p>
            )}
          </>
        )}

        <div className="btn-row">
          <Link href="/" className="btn btn-secondary">
            라이브러리로
          </Link>
        </div>
      </main>
    </>
  );
}
