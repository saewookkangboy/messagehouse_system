"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  importIntegrationDocument,
  listImportableDocuments,
  listOrgDocuments,
  uploadOrgDocument,
  type ImportableDoc,
} from "@/lib/apiClient";

type DocRow = {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { name: string; email: string } | null;
};

type ImportProvider = "notion" | "google";

export default function OrgDocumentsPage() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 외부 가져오기 상태
  const [importProvider, setImportProvider] = useState<ImportProvider>("notion");
  const [importList, setImportList] = useState<ImportableDoc[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

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

  async function loadImportList() {
    setLoadingList(true);
    setImportError(null);
    setImportNote(null);
    setImportList(null);
    try {
      const res = await listImportableDocuments(importProvider);
      setImportList(res.documents);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "목록을 불러오지 못했어요.");
    } finally {
      setLoadingList(false);
    }
  }

  async function doImport(doc: ImportableDoc) {
    setImportingId(doc.externalId);
    setImportError(null);
    setImportNote(null);
    try {
      await importIntegrationDocument(importProvider, {
        externalId: doc.externalId,
        title: doc.title,
      });
      setImportNote(`"${doc.title}"을(를) 가져왔어요.`);
      const res = await listOrgDocuments();
      setDocs(res.documents as DocRow[]);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "가져오기에 실패했어요.");
    } finally {
      setImportingId(null);
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

        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>외부에서 가져오기</h2>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>
            연동된 Notion·Google Drive에서 문서를 직접 가져와 조직 라이브러리에 추가해요.
            (설정 → 연동에서 먼저 연결이 필요해요.)
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={importProvider}
              onChange={(e) => {
                setImportProvider(e.target.value as ImportProvider);
                setImportList(null);
                setImportError(null);
                setImportNote(null);
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}
            >
              <option value="notion">Notion</option>
              <option value="google">Google Drive</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadImportList}
              disabled={loadingList}
            >
              {loadingList ? "불러오는 중..." : "문서 목록 불러오기"}
            </button>
          </div>

          {importError && (
            <div className="error-box" style={{ marginTop: 12 }}>{importError}</div>
          )}
          {importNote && (
            <p style={{ fontSize: 13, color: "var(--accent)", marginTop: 10 }}>{importNote}</p>
          )}

          {importList && importList.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
              가져올 수 있는 문서가 없어요.
            </p>
          )}
          {importList && importList.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {importList.map((d) => (
                <li
                  key={d.externalId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 0",
                    borderTop: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.title}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => doImport(d)}
                    disabled={importingId === d.externalId}
                  >
                    {importingId === d.externalId ? "가져오는 중..." : "가져오기"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
