"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { register } from "@/lib/apiClient";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({ name, email, password, teamName: teamName || undefined });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했어요.");
      setLoading(false);
    }
  }

  return (
    <>
      <Header subtitle="회원가입" />
      <main className="page" id="main-content" style={{ maxWidth: 420 }}>
        <h1 className="page-title">회원가입</h1>
        <p className="page-desc">새 팀을 만들고 Context Pack을 함께 관리하세요.</p>

        <form className="card" onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="name" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>이름</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>이메일</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="password" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>비밀번호 (8자 이상)</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="teamName" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>팀 이름 (선택)</label>
            <input id="teamName" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="예: 홍보팀"
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </main>
    </>
  );
}
