"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { accountExportUrl, deleteAccount } from "@/lib/apiClient";

export default function AccountSettingsPage() {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "계정 삭제에 실패했어요.");
      setDeleting(false);
    }
  }

  return (
    <>
      <Header subtitle="계정 설정" />
      <main className="page" id="main-content" style={{ maxWidth: 640 }}>
        <div className="eyebrow">계정</div>
        <h1 className="page-title">계정 설정</h1>
        <p className="page-desc">
          내 데이터를 내보내거나 계정을 영구 삭제할 수 있어요.
        </p>

        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>데이터 내보내기</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
            내 계정 정보·팀 멤버십·Context Pack 목록을 JSON으로 내려받아요.
          </p>
          <a href={accountExportUrl} className="btn btn-secondary" download>
            내 데이터 내보내기 (JSON)
          </a>
        </div>

        <div className="card" style={{ borderColor: "var(--danger-border)" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#7f1d1d" }}>계정 삭제</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
            계정과 단독 소유한 팀·Context Pack이 <strong>영구 삭제</strong>돼요. 되돌릴 수
            없어요. 다른 팀원이 있는 팀의 소유자라면 먼저 소유권을 이양해야 해요.
          </p>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
            확인을 위해 <code>삭제</code>를 입력하세요
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="삭제"
            style={{
              width: "100%",
              marginTop: 6,
              marginBottom: 12,
              padding: "9px 12px",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          {error && <div className="error-box">{error}</div>}
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: "#b91c1c" }}
            disabled={confirmText !== "삭제" || deleting}
            onClick={handleDelete}
          >
            {deleting ? "삭제 중..." : "계정 영구 삭제"}
          </button>
        </div>
      </main>
    </>
  );
}
