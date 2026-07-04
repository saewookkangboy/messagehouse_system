"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, logout, switchTeam } from "@/lib/apiClient";

type TeamOption = { id: string; name: string; role: string };

export function Header({ subtitle }: { subtitle?: string }) {
  const [user, setUser] = useState<{ name: string; teamName?: string } | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

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
          setActiveTeamId(res.team.id);
          if ("teams" in res && Array.isArray(res.teams)) {
            setTeams(res.teams as TeamOption[]);
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  async function handleSwitchTeam(teamId: string) {
    if (teamId === activeTeamId) return;
    try {
      await switchTeam(teamId);
      // 활성 팀이 바뀌면 팀 스코프 데이터가 전부 달라지므로 새로고침해요.
      window.location.reload();
    } catch {
      /* 무시 — 실패 시 현재 팀 유지 */
    }
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
              {teams.length > 1 ? (
                <select
                  className="header-team-switch"
                  aria-label="활성 팀 전환"
                  value={activeTeamId ?? ""}
                  onChange={(e) => handleSwitchTeam(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="header-user">
                  {user.name}
                  {user.teamName ? ` · ${user.teamName}` : ""}
                </span>
              )}
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
