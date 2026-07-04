"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, logout } from "@/lib/apiClient";

export function Header({ subtitle }: { subtitle?: string }) {
  const [user, setUser] = useState<{ name: string; teamName?: string } | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <button
          type="button"
          className="header-menu-toggle"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            {menuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
        <nav className={`header-nav${menuOpen ? " open" : ""}`}>
          <Link href="/org-documents" className="header-link" onClick={() => setMenuOpen(false)}>
            조직 문서
          </Link>
          {authEnabled && user && (
            <>
              <Link
                href="/settings/integrations"
                className="header-link"
                onClick={() => setMenuOpen(false)}
              >
                연동
              </Link>
              <Link href="/settings/team" className="header-link" onClick={() => setMenuOpen(false)}>
                팀 설정
              </Link>
              <Link href="/settings/account" className="header-link" onClick={() => setMenuOpen(false)}>
                계정
              </Link>
            </>
          )}
          {authEnabled && user ? (
            <>
              <span className="header-user">
                {user.name}
                {user.teamName ? ` · ${user.teamName}` : ""}
              </span>
              <button type="button" className="header-link" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : authEnabled ? (
            <Link href="/login" className="header-link" onClick={() => setMenuOpen(false)}>
              로그인
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
