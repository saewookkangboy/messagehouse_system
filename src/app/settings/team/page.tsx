"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  createTeamInvite,
  listTeamInvites,
  listTeamMembers,
  revokeTeamInvite,
  updateTeamMemberRole,
} from "@/lib/apiClient";

type Member = {
  userId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  user: { id: string; email: string; name: string };
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  invitePath: string;
  expiresAt: string;
};

const ROLE_LABEL = { owner: "소유자", admin: "관리자", editor: "편집자", viewer: "뷰어" };

export default function TeamSettingsPage() {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [membersRes, invitesRes] = await Promise.all([
      listTeamMembers(),
      listTeamInvites(),
    ]);
    setTeamName(membersRes.team.name);
    setMembers(membersRes.members as Member[]);
    setInvites(invitesRes.invites as InviteRow[]);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function changeRole(userId: string, role: "admin" | "editor" | "viewer") {
    try {
      await updateTeamMemberRole(userId, role);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 변경에 실패했어요.");
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await createTeamInvite({ email: inviteEmail, role: inviteRole });
      setLastInviteLink(res.invite.invitePath);
      setLastInviteEmailSent(res.emailSent);
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "초대 생성에 실패했어요.");
    }
  }

  async function cancelInvite(id: string) {
    await revokeTeamInvite(id);
    await load();
  }

  return (
    <>
      <Header subtitle="팀 설정" />
      <main className="page" id="main-content">
        <div className="eyebrow">팀 권한 관리</div>
        <h1 className="page-title">{teamName || "팀 설정"}</h1>
        <p className="page-desc">
          팀원을 초대하고 역할을 관리해요. 소유자·관리자만 초대와 역할 변경이 가능해요.
        </p>

        {error && <div className="error-box">{error}</div>}
        {loading && <div className="empty-state">불러오는 중...</div>}

        {!loading && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>팀원 초대</h2>
              <form onSubmit={sendInvite} className="auth-form">
                <label>
                  이메일
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    required
                  />
                </label>
                <label>
                  역할
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "admin" | "editor" | "viewer")
                    }
                  >
                    <option value="editor">편집자</option>
                    <option value="viewer">뷰어</option>
                    <option value="admin">관리자</option>
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  초대 링크 만들기
                </button>
              </form>
              {lastInviteLink && (
                <p style={{ fontSize: 13, marginTop: 12 }}>
                  {lastInviteEmailSent
                    ? "초대 이메일을 보냈어요. 혹시 못 받으면 아래 링크를 직접 전달해주세요:"
                    : "이메일 발송은 아직 연결되지 않았어요 — 아래 링크를 복사해서 직접 전달해주세요:"}{" "}
                  <code>
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${lastInviteLink}`
                      : lastInviteLink}
                  </code>
                </p>
              )}
            </div>

            {invites.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>대기 중인 초대</h2>
                <table className="lib">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>역할</th>
                      <th>만료</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td>{ROLE_LABEL[inv.role as keyof typeof ROLE_LABEL] ?? inv.role}</td>
                        <td className="tnum">
                          {new Date(inv.expiresAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => cancelInvite(inv.id)}
                          >
                            취소
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card">
              <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>팀원</h2>
              <div className="table-scroll">
                <table className="lib">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>이메일</th>
                      <th>역할</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.userId}>
                        <td>{m.user.name}</td>
                        <td>{m.user.email}</td>
                        <td>
                          {m.role === "owner" ? (
                            ROLE_LABEL.owner
                          ) : (
                            <select
                              value={m.role}
                              onChange={(e) =>
                                changeRole(
                                  m.userId,
                                  e.target.value as "admin" | "editor" | "viewer",
                                )
                              }
                              style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
                            >
                              <option value="admin">관리자</option>
                              <option value="editor">편집자</option>
                              <option value="viewer">뷰어</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
