"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { getMe, login } from "@/lib/apiClient";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했어요.");
      setLoading(false);
    }
  }

  return (
    <>
      <Header subtitle="로그인" />
      <main className="page" id="main-content" style={{ maxWidth: 420 }}>
        <h1 className="page-title">로그인</h1>
        <p className="page-desc">팀 계정으로 메시지하우스 Context Builder에 접속하세요.</p>

        <form className="card" onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="password" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
          계정이 없으신가요? <Link href="/register">회원가입</Link>
        </p>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page">불러오는 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
