"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, logout } from "@/lib/apiClient";

export function Header({ subtitle }: { subtitle?: string }) {
  const [user, setUser] = useState<{ name: string; teamName?: string } | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    getMe()
      .then((res) => {
        if ("authDisabled" in res && res.authDisabled) {
          setAuthEnabled(false);
          return;
        }
        setAuthEnabled(true);
        if (res.authenticated && "user" in res) {
          setUser({ name: res.user.name, teamName: res.team.name });
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <header className="header">
      <div className="header-row">
        <Link href="/" className="brand">
          <div className="brand-mark">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 20V10l8-6 8 6v10M9 20v-7h6v7" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="name">메시지하우스 Context Builder</span>
            <span className="sub">{subtitle ?? "PR Message OS · Agent 1"}</span>
          </div>
        </Link>
        <nav style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <Link href="/org-documents" className="row-action">조직 문서</Link>
          {authEnabled && user && (
            <>
              <Link href="/settings/integrations" className="row-action">연동</Link>
              <Link href="/settings/team" className="row-action">팀 설정</Link>
            </>
          )}
          {authEnabled && user ? (
            <>
              <span style={{ color: "var(--muted)" }}>
                {user.name}
                {user.teamName ? ` · ${user.teamName}` : ""}
              </span>
              <button type="button" className="row-action" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : authEnabled ? (
            <Link href="/login" className="row-action">로그인</Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
