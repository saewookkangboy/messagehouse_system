"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { listContextPacks, type ContextPack } from "@/lib/apiClient";

type Row = ContextPack & { _count: { files: number } };

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  review: "검토중",
  confirmed: "확정",
};

export default function HomePage() {
  const [packs, setPacks] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listContextPacks()
      .then((res) => setPacks(res.contextPacks as Row[]))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="page" id="main-content">
        <div className="eyebrow">Context Pack 라이브러리</div>
        <h1 className="page-title">메시지하우스 Context Builder</h1>
        <p className="page-desc">
          보도자료·발표자료·기획안 파일을 업로드하면 자동으로 분석하고, 메시지하우스
          프레임워크에 맞게 Context Pack을 완성해줘요.
        </p>

        <div
          className="btn-row"
          style={{ justifyContent: "flex-start", marginTop: 0, marginBottom: 22 }}
        >
          <Link href="/packs/new" className="btn btn-primary">
            새 Context Pack 시작하기
          </Link>
        </div>

        {error && <div className="error-box">{error}</div>}

        {packs === null && !error && <div className="empty-state">불러오는 중...</div>}

        {packs && packs.length === 0 && (
          <div className="empty-state">
            아직 만들어진 Context Pack이 없어요. 위 버튼으로 첫 Context Pack을
            시작해보세요.
          </div>
        )}

        {packs && packs.length > 0 && (
          <div className="card">
            <div className="table-scroll">
              <table className="lib">
                <thead>
                  <tr>
                    <th>이슈명</th>
                    <th>업종</th>
                    <th>버전</th>
                    <th>상태</th>
                    <th>파일</th>
                    <th>최종 수정</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {packs.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.issue === "제목 없는 이슈" ? (
                          <span style={{ color: "var(--muted-2)", fontStyle: "italic" }}>
                            제목 없는 이슈
                          </span>
                        ) : (
                          p.issue
                        )}
                      </td>
                      <td>{p.industry ?? "—"}</td>
                      <td className="tnum">v{p.version}</td>
                      <td>
                        <span className={`status-dot ${p.status}`}>
                          <i />
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="tnum">{p._count.files}개</td>
                      <td className="tnum">
                        {new Date(p.updatedAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td>
                        <Link
                          href={
                            p.status === "draft"
                              ? `/packs/${p.id}/analysis`
                              : `/packs/${p.id}/review`
                          }
                          className="row-action"
                        >
                          열기
                        </Link>
                      </td>
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
