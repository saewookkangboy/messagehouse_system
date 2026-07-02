"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { acceptInvite, getInvitePreview } from "@/lib/apiClient";
import { getMe } from "@/lib/apiClient";

function InviteAcceptForm() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [preview, setPreview] = useState<{
    email: string;
    role: string;
    teamName: string;
    expiresAt: string;
  } | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getInvitePreview(token), getMe()])
      .then(([inv, me]) => {
        setPreview(inv.invite);
        setLoggedIn(Boolean(me.authenticated));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (loggedIn) {
        await acceptInvite(token);
      } else {
        await acceptInvite(token, { name, password });
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "초대 수락에 실패했어요.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="empty-state">초대 정보를 불러오는 중...</div>;
  }

  if (!preview) {
    return (
      <div className="error-box">{error ?? "초대 링크를 확인할 수 없어요."}</div>
    );
  }

  return (
    <>
      <Header subtitle="팀 초대" />
      <main className="page auth-page" id="main-content">
        <div className="card auth-card">
          <h1 className="page-title">{preview.teamName} 팀 초대</h1>
          <p className="page-desc">
            <strong>{preview.email}</strong> 주소로{" "}
            <strong>{preview.role}</strong> 역할 초대가 도착했어요.
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            만료: {new Date(preview.expiresAt).toLocaleString("ko-KR")}
          </p>

          {loggedIn ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => handleAccept()}
              style={{ width: "100%", marginTop: 16 }}
            >
              {submitting ? "수락 중..." : "초대 수락하기"}
            </button>
          ) : (
            <form onSubmit={handleAccept} className="auth-form">
              <label>
                이름
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                비밀번호 (8자 이상)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                이미 계정이 있으신가요?{" "}
                <Link href={`/login?next=/invite/${token}`}>로그인 후 수락</Link>
              </p>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "가입 중..." : "가입하고 팀 참여"}
              </button>
            </form>
          )}

          {error && <div className="error-box">{error}</div>}
        </div>
      </main>
    </>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="page">불러오는 중...</div>}>
      <InviteAcceptForm />
    </Suspense>
  );
}
