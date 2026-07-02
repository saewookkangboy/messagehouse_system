"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import {
  disconnectIntegration,
  getIntegrations,
  updateIntegrationSettings,
  type IntegrationConnectionRow,
} from "@/lib/apiClient";

const ERROR_MESSAGES: Record<string, string> = {
  auth_disabled: "외부 연동은 AUTH_DISABLED=false 로그인 모드에서만 사용할 수 있어요.",
  login_required: "연동하려면 먼저 로그인해주세요.",
  invalid_state: "OAuth 상태가 유효하지 않아요. 다시 시도해주세요.",
  google_oauth_failed: "Google 연동에 실패했어요.",
  notion_oauth_failed: "Notion 연동에 실패했어요.",
};

/** 워크스페이스에 생성된 Export용 Notion DB — docs/integrations-oauth-setup.md 참고 */
const SUGGESTED_NOTION_DATABASE_ID = "f246b7ad3edb4203be2c29cbdbb4ccb6";

function IntegrationsSettingsInner() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<IntegrationConnectionRow[]>([]);
  const [configured, setConfigured] = useState({ google: false, notion: false });
  const [authRequired, setAuthRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [googleFolderId, setGoogleFolderId] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [notionParentPageId, setNotionParentPageId] = useState("");
  const [notionTitleProperty, setNotionTitleProperty] = useState("Name");

  async function load() {
    const res = await getIntegrations();
    setAuthRequired(res.authRequired);
    setConfigured(res.configured);
    setConnections(res.connections);
    const google = res.connections.find((c) => c.provider === "google_drive");
    const notion = res.connections.find((c) => c.provider === "notion");
    if (google?.metadata.defaultFolderId) setGoogleFolderId(google.metadata.defaultFolderId);
    if (notion?.metadata.notionDatabaseId) setNotionDatabaseId(notion.metadata.notionDatabaseId);
    if (notion?.metadata.notionParentPageId) setNotionParentPageId(notion.metadata.notionParentPageId);
    if (notion?.metadata.titlePropertyName) setNotionTitleProperty(notion.metadata.titlePropertyName);
  }

  useEffect(() => {
    (async () => {
      const errKey = searchParams.get("error");
      const connected = searchParams.get("connected");
      if (errKey) setError(ERROR_MESSAGES[errKey] ?? "연동 중 오류가 발생했어요.");
      if (connected === "google") setSuccess("Google Drive 연동이 완료되었어요.");
      if (connected === "notion") setSuccess("Notion 연동이 완료되었어요.");

      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  const googleConn = connections.find((c) => c.provider === "google_drive");
  const notionConn = connections.find((c) => c.provider === "notion");

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const googleCallback = `${origin}/api/integrations/google/callback`;
  const notionCallback = `${origin}/api/integrations/notion/callback`;

  function applySuggestedNotionDb() {
    setNotionDatabaseId(SUGGESTED_NOTION_DATABASE_ID);
    setNotionTitleProperty("Name");
  }

  async function saveGoogleSettings() {
    setError(null);
    try {
      await updateIntegrationSettings("google", {
        defaultFolderId: googleFolderId.trim() || undefined,
      });
      setSuccess("Google Drive 저장 위치가 저장되었어요.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    }
  }

  async function saveNotionSettings() {
    setError(null);
    try {
      await updateIntegrationSettings("notion", {
        notionDatabaseId: notionDatabaseId.trim() || undefined,
        notionParentPageId: notionParentPageId.trim() || undefined,
        titlePropertyName: notionTitleProperty.trim() || "Name",
      });
      setSuccess("Notion 저장 위치가 저장되었어요.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    }
  }

  async function disconnect(provider: "google" | "notion") {
    await disconnectIntegration(provider);
    await load();
    setSuccess(`${provider === "google" ? "Google Drive" : "Notion"} 연동이 해제되었어요.`);
  }

  return (
    <>
      <Header subtitle="외부 연동" />
      <main className="page" id="main-content">
        <div className="eyebrow">Export 연동</div>
        <h1 className="page-title">Notion · Google Drive</h1>
        <p className="page-desc">
          확정된 Context Pack을 Notion 페이지 또는 Google Drive 파일로 저장해요. 연동은
          사용자별 OAuth로 동작하며, 토큰은 서버에 암호화되어 저장돼요.
        </p>

        {error && <div className="error-box">{error}</div>}
        {success && (
          <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
            {success}
          </div>
        )}
        {loading && <div className="empty-state">불러오는 중...</div>}

        {!loading && authRequired && (
          <div className="card">
            <p style={{ margin: 0 }}>
              데모 모드(AUTH_DISABLED=true)에서는 외부 연동을 사용할 수 없어요.{" "}
              <code>.env</code>에서 <code>AUTH_DISABLED=false</code>로 설정하고 로그인한 뒤
              다시 시도해주세요.
            </p>
          </div>
        )}

        {!loading && !authRequired && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>OAuth 앱 등록 안내</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                Google Cloud·Notion 개발자 콘솔에 아래 리디렉션 URI를 등록한 뒤, 발급받은
                클라이언트 ID/시크릿을 <code>.env</code>에 넣고 dev 서버를 재시작하세요.
                상세 절차는 레포의 <code>docs/integrations-oauth-setup.md</code>를 참고하세요.
              </p>
              <p style={{ fontSize: 12, margin: "0 0 6px" }}>
                <strong>Google</strong>{" "}
                <code style={{ wordBreak: "break-all" }}>{googleCallback}</code>
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                <strong>Notion</strong>{" "}
                <code style={{ wordBreak: "break-all" }}>{notionCallback}</code>
              </p>
              <p style={{ fontSize: 12, margin: "12px 0 0", color: "var(--muted)" }}>
                Notion Export DB ID (권한 연결 후 사용):{" "}
                <code>{SUGGESTED_NOTION_DATABASE_ID}</code>
              </p>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Google Drive</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                Markdown 파일로 업로드해요. 폴더 ID를 비우면 내 드라이브 루트에 저장돼요.
              </p>
              {!configured.google && (
                <p className="error-box" style={{ marginBottom: 12 }}>
                  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경변수가 필요해요.
                </p>
              )}
              {googleConn?.connected ? (
                <>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>
                    연결됨
                    {googleConn.workspaceName ? ` · ${googleConn.workspaceName}` : ""}
                  </p>
                  <label style={{ display: "block", marginBottom: 12 }}>
                    기본 폴더 ID (선택)
                    <input
                      value={googleFolderId}
                      onChange={(e) => setGoogleFolderId(e.target.value)}
                      placeholder="1abc... 폴더 URL의 ID"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <div className="btn-row">
                    <button type="button" className="btn btn-secondary" onClick={saveGoogleSettings}>
                      저장 위치 저장
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => disconnect("google")}
                    >
                      연동 해제
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  href="/api/integrations/google/connect"
                  className={`btn btn-primary${!configured.google ? " disabled" : ""}`}
                  aria-disabled={!configured.google}
                  onClick={(e) => {
                    if (!configured.google) e.preventDefault();
                  }}
                >
                  Google Drive 연결
                </Link>
              )}
            </div>

            <div className="card">
              <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Notion</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                데이터베이스 ID 또는 상위 페이지 ID 중 하나를 설정해주세요. 연동한 워크스페이스에서
                해당 페이지/DB에 접근 권한을 부여해야 해요.
              </p>
              {!configured.notion && (
                <p className="error-box" style={{ marginBottom: 12 }}>
                  NOTION_CLIENT_ID / NOTION_CLIENT_SECRET 환경변수가 필요해요.
                </p>
              )}
              {notionConn?.connected ? (
                <>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>
                    연결됨
                    {notionConn.workspaceName ? ` · ${notionConn.workspaceName}` : ""}
                  </p>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    데이터베이스 ID (선택)
                    <input
                      value={notionDatabaseId}
                      onChange={(e) => setNotionDatabaseId(e.target.value)}
                      placeholder="32자 Notion database ID"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginBottom: 12 }}
                    onClick={applySuggestedNotionDb}
                  >
                    MessageHouse Context Packs DB ID 사용
                  </button>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    상위 페이지 ID (DB 없을 때)
                    <input
                      value={notionParentPageId}
                      onChange={(e) => setNotionParentPageId(e.target.value)}
                      placeholder="32자 Notion page ID"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <label style={{ display: "block", marginBottom: 12 }}>
                    DB 제목 속성명
                    <input
                      value={notionTitleProperty}
                      onChange={(e) => setNotionTitleProperty(e.target.value)}
                      placeholder="Name"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <div className="btn-row">
                    <button type="button" className="btn btn-secondary" onClick={saveNotionSettings}>
                      저장 위치 저장
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => disconnect("notion")}
                    >
                      연동 해제
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  href="/api/integrations/notion/connect"
                  className={`btn btn-primary${!configured.notion ? " disabled" : ""}`}
                  aria-disabled={!configured.notion}
                  onClick={(e) => {
                    if (!configured.notion) e.preventDefault();
                  }}
                >
                  Notion 연결
                </Link>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={<div className="page">불러오는 중...</div>}>
      <IntegrationsSettingsInner />
    </Suspense>
  );
}
