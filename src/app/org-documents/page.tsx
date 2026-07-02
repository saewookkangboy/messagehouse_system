"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { listOrgDocuments, uploadOrgDocument } from "@/lib/apiClient";

type DocRow = {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { name: string; email: string } | null;
};

export default function OrgDocumentsPage() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    listOrgDocuments()
      .then((res) => setDocs(res.documents as DocRow[]))
      .catch((e) => setError(e.message));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadOrgDocument({ title: title.trim(), description, file });
      setDocs((prev) => [res.document as DocRow, ...(prev ?? [])]);
      setTitle("");
      setDescription("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Header subtitle="조직 문서 라이브러리" />
      <main className="page" id="main-content">
        <div className="eyebrow">F-05 · 팀 공유 RAG</div>
        <h1 className="page-title">조직 문서 라이브러리</h1>
        <p className="page-desc">
          팀 전체가 공유하는 참고 문서를 올려두면, Context Pack 생성 시 RAG로 자동 주입돼요.
        </p>

        <form className="card" onSubmit={handleUpload}>
          <div style={{ display: "grid", gap: 12 }}>
            <input placeholder="문서 제목" required value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
            <input placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
            <input type="file" accept=".txt,.md,.pdf,.docx,.hwp,.hwpx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? "업로드 중..." : "조직 문서 업로드"}
            </button>
          </div>
        </form>

        {error && <div className="error-box">{error}</div>}

        {docs === null && !error && <div className="empty-state">불러오는 중...</div>}
        {docs && docs.length === 0 && <div className="empty-state">등록된 조직 문서가 없어요.</div>}

        {docs && docs.length > 0 && (
          <div className="card">
            <div className="table-scroll">
              <table className="lib">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>파일</th>
                    <th>업로더</th>
                    <th>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>{d.title}</td>
                      <td>{d.filename}</td>
                      <td>{d.uploadedBy?.name ?? "—"}</td>
                      <td className="tnum">{new Date(d.createdAt).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
