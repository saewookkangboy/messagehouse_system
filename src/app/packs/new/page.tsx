"use client";

import { useState, type ChangeEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { createContextPack } from "@/lib/apiClient";

const fieldStyle: CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "9px 12px",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  fontSize: 13,
};

const labelStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--muted)",
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const shared = {
    id,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    style: fieldStyle,
  };

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input type="text" {...shared} />
      )}
    </div>
  );
}

export default function NewContextPackPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("");
  const [purpose, setPurpose] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed =
    topic.trim().length > 0 &&
    domain.trim().length > 0 &&
    purpose.trim().length > 0 &&
    targetAudience.trim().length > 0;

  async function handleNext() {
    if (!canProceed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createContextPack({
        issue: topic.trim(),
        industry: domain.trim(),
        purpose: purpose.trim(),
        targetAudience: targetAudience.trim(),
      });
      router.push(`/packs/${res.contextPack.id}/upload`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header subtitle="Step 1 · 기본 정보" />
      <Stepper current="intake" />
      <main className="page" id="main-content">
        <div className="eyebrow">Step 1</div>
        <h1 className="page-title">메시지하우스 기본 정보를 입력하세요</h1>
        <p className="page-desc">
          주제와 활용 맥락을 먼저 정리하면, 이후 문서 분석과 메시지 생성이 더
          정확해져요.
        </p>

        <div className="card" style={{ display: "grid", gap: 16 }}>
          <Field
            id="topic"
            label="메시지하우스 주제"
            value={topic}
            onChange={setTopic}
            placeholder="예: AI 언더라이팅 신상품 출시"
          />
          <Field
            id="domain"
            label="카테고리(도메인)"
            value={domain}
            onChange={setDomain}
            placeholder="예: 보험, 금융, IT, 헬스케어"
          />
          <Field
            id="purpose"
            label="메시지하우스 활용 목적"
            value={purpose}
            onChange={setPurpose}
            placeholder="예: 신제품 보도자료, IR 발표, 내부 커뮤니케이션 가이드"
            multiline
          />
          <Field
            id="targetAudience"
            label="타겟 오디언스"
            value={targetAudience}
            onChange={setTargetAudience}
            placeholder="예: 일반 소비자, 언론, 투자자, 내부 임직원"
            multiline
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceed || submitting}
            onClick={handleNext}
          >
            {submitting ? "저장 중..." : "다음: 파일 업로드"}
          </button>
        </div>
      </main>
    </>
  );
}
