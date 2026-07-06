"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { getContextPack, patchContextPack, type ContextPack, type SourceFile } from "@/lib/apiClient";
import {
  deserializePillars,
  deserializeStringList,
  deserializeResearchResult,
} from "@/lib/contextPackSerialization";
import { deriveFoundationItems, joinFoundations, splitFoundation, FOUNDATION_ITEM_LABELS } from "@/lib/foundation";
import {
  composeFoundationSentence,
  refineNaturalMessageHouse,
} from "@/lib/messageHouseSentence";
import type { MessageHouse } from "@/lib/ai/schema";
import type { ResearchResult } from "@/lib/research/schema";
import type { Pillar } from "@/lib/ai/schema";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [pack, setPack] = useState<ContextPack | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [roofMessage, setRoofMessage] = useState("");
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [objectionsText, setObjectionsText] = useState("");
  const [aieoSummary, setAieoSummary] = useState("");
  const [riskFlagsText, setRiskFlagsText] = useState("");
  const [forbiddenTerms, setForbiddenTerms] = useState("");
  const [officialTerms, setOfficialTerms] = useState("");

  const [gate1, setGate1] = useState(false);
  const [gate2, setGate2] = useState(false);
  const [gate3, setGate3] = useState(false);

  useEffect(() => {
    getContextPack(id)
      .then((res) => {
        const p = res.contextPack;
        setPack(p);
        setFiles(p.files ?? []);
        setResearch(deserializeResearchResult(p.researchResult));
        const loadedPillars = deserializePillars(p.pillars);
        const legacyParts = splitFoundation(p.foundation ?? "");
        const pillarsWithFoundation = loadedPillars.map((pillar, i) => ({
          ...pillar,
          foundation: pillar.foundation?.trim() || legacyParts[i] || "",
        }));
        const natural = refineNaturalMessageHouse(
          {
            roofMessage: p.roofMessage ?? "",
            pillars: pillarsWithFoundation,
            foundation: p.foundation ?? "",
            objections: deserializeStringList(p.objections),
            aieoSummary: p.aieoSummary ?? "",
            riskFlags: deserializeStringList(p.riskFlags),
            forbiddenTerms: p.forbiddenTerms ?? "",
            officialTerms: p.officialTerms ?? "",
          },
          p.issue ?? "",
          p.industry,
        );
        setRoofMessage(natural.roofMessage);
        setPillars(natural.pillars);
        setObjectionsText(natural.objections.join("\n"));
        setAieoSummary(natural.aieoSummary);
        setRiskFlagsText(natural.riskFlags.join("\n"));
        setForbiddenTerms(p.forbiddenTerms ?? "");
        setOfficialTerms(p.officialTerms ?? "");
        setGate1(p.gateMessageReviewed);
        setGate2(p.gateNoConfidential);
        setGate3(p.gateNumbersVerified);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function buildNaturalHouse(): MessageHouse {
    return refineNaturalMessageHouse(
      {
        roofMessage,
        pillars,
        foundation: joinFoundations(pillars.map((p) => p.foundation)),
        objections: objectionsText.split("\n").map((s) => s.trim()).filter(Boolean),
        aieoSummary,
        riskFlags: riskFlagsText.split("\n").map((s) => s.trim()).filter(Boolean),
        forbiddenTerms,
        officialTerms,
      },
      pack?.issue ?? "",
      pack?.industry,
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const natural = buildNaturalHouse();
      const res = await patchContextPack(id, {
        roofMessage: natural.roofMessage,
        pillars: natural.pillars,
        foundation: natural.foundation,
        objections: natural.objections,
        aieoSummary: natural.aieoSummary,
        riskFlags: natural.riskFlags,
        forbiddenTerms,
        officialTerms,
      });
      setPack(res.contextPack);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleGate(which: 1 | 2 | 3, value: boolean) {
    const field =
      which === 1
        ? "gateMessageReviewed"
        : which === 2
          ? "gateNoConfidential"
          : "gateNumbersVerified";
    if (which === 1) setGate1(value);
    if (which === 2) setGate2(value);
    if (which === 3) setGate3(value);
    await patchContextPack(id, { [field]: value }).catch(() => {});
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      await handleSave();
      await patchContextPack(id, { status: "confirmed" });
      router.push(`/packs/${id}/export`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "확정하지 못했어요.");
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header subtitle="검토 · 수정" />
        <main className="page" id="main-content">
          <div className="empty-state">불러오는 중...</div>
        </main>
      </>
    );
  }

  if (!pack?.roofMessage) {
    return (
      <>
        <Header subtitle="검토 · 수정" />
        <main className="page" id="main-content">
          <div className="error-box">
            아직 메시지하우스가 생성되지 않았어요.{" "}
            <Link href={`/packs/${id}/analysis`}>파일 분석 화면으로 이동</Link>
          </div>
        </main>
      </>
    );
  }

  const allGatesChecked = gate1 && gate2 && gate3;

  return (
    <>
      <Header subtitle="Human-in-the-Loop · F-05" />
      <Stepper current="review" />
      <main className="page" id="main-content">
        <div className="eyebrow">Human-in-the-Loop · F-05</div>
        <h1 className="page-title">검토 · 수정</h1>
        <p className="page-desc">
          자동 생성된 메시지하우스 초안을 확인하고 필요한 부분을 직접 수정하세요.
          최종 확정은 반드시 사람이 해요.
        </p>

        {error && <div className="error-box">{error}</div>}

        <div className="house-wrap">
          <div className="roof">
            <div className="eyebrow">지붕 · Roof — 우산 메시지</div>
            <textarea
              className="edit-input"
              style={{ background: "transparent", color: "#fff", borderColor: "#333" }}
              rows={2}
              value={roofMessage}
              onChange={(e) => setRoofMessage(e.target.value)}
            />
          </div>

          <div className="pillar-columns">
            {pillars.map((p, i) => (
              <div className="pillar-column" key={p.id}>
                <div className={`pillar${p.source === "research_enhanced" ? " enhanced" : ""}`}>
                  <div className="ptheme">
                    기둥 {i + 1} · {p.theme}
                  </div>
                  <p className="pmsg pillar-message">{p.message}</p>
                  <div className="pev">근거: {p.evidence}</div>
                  <span className={`tag${p.source === "research_enhanced" ? " tag-dark" : ""}`}>
                    {p.source === "research_enhanced" ? "리서치 보강" : "파일 추출"}
                  </span>
                </div>
                <div className="foundation">
                  <div className="foundation-head">
                    <b>기반 (Foundation)</b>
                    <span>근거·수치·사례</span>
                  </div>
                  <ul className="foundation-list" aria-label={`기둥 ${i + 1} 기반 자료`}>
                    {deriveFoundationItems(p, i, files, research).map((item, j) => (
                      <li key={FOUNDATION_ITEM_LABELS[j]}>
                        <span className="foundation-label">{FOUNDATION_ITEM_LABELS[j]}</span>
                        <p
                          className={`foundation-item${FOUNDATION_ITEM_LABELS[j] === "수치" ? " mono tnum" : ""}${item === "원본 자료에서 확인되지 않았어요" ? " muted" : ""}`}
                        >
                          {composeFoundationSentence(
                            FOUNDATION_ITEM_LABELS[j],
                            item,
                            pack?.issue ?? "",
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="side2">
            <div className="side-card">
              <div className="lbl">
                <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />
                </svg>
                오해 방지 문장
              </div>
              <textarea
                className="edit-input"
                rows={4}
                value={objectionsText}
                onChange={(e) => setObjectionsText(e.target.value)}
              />
            </div>
            <div className="side-card">
              <div className="lbl">
                <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
                  <path d="M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
                </svg>
                AIEO Layer — AI 인용용 요약
              </div>
              <textarea
                className="edit-input"
                rows={4}
                value={aieoSummary}
                onChange={(e) => setAieoSummary(e.target.value)}
              />
            </div>
          </div>

          <div className="riskbox">
            <div className="lbl">
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                style={{ stroke: "var(--danger)" }}
              >
                <path d="M12 3L2 21h20L12 3z" />
                <path d="M12 10v5M12 18h.01" />
              </svg>
              Risk Flags — 반드시 사람이 확인해야 해요 (줄바꿈으로 구분)
            </div>
            <textarea
              className="edit-input"
              rows={3}
              style={{ background: "transparent" }}
              value={riskFlagsText}
              onChange={(e) => setRiskFlagsText(e.target.value)}
            />
          </div>

          <div className="terms-row">
            <div className="t">
              <b>금지 표현</b>
              <input
                value={forbiddenTerms}
                onChange={(e) => setForbiddenTerms(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12,
                }}
              />
            </div>
            <div className="t">
              <b>공식 용어</b>
              <input
                value={officialTerms}
                onChange={(e) => setOfficialTerms(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleSave}>
            {saving ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>

        <div className="approval-bar">
          <div className="check-row">
            <input
              type="checkbox"
              id="gate1"
              checked={gate1}
              onChange={(e) => toggleGate(1, e.target.checked)}
            />
            <label htmlFor="gate1">최종 메시지를 확인했어요 (법무·경영진 확인 포함)</label>
          </div>
          <div className="check-row">
            <input
              type="checkbox"
              id="gate2"
              checked={gate2}
              onChange={(e) => toggleGate(2, e.target.checked)}
            />
            <label htmlFor="gate2">미공개 정보가 포함되어 있지 않아요</label>
          </div>
          <div className="check-row">
            <input
              type="checkbox"
              id="gate3"
              checked={gate3}
              onChange={(e) => toggleGate(3, e.target.checked)}
            />
            <label htmlFor="gate3">AI가 생성한 수치를 원본과 대조했어요</label>
          </div>
          <div className="gate-note">
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span>
              사람 필수 확인 구간이에요. 위 3개 항목을 모두 체크해야 확정할 수 있어요.
              (서버에서도 동일하게 검증해요.)
            </span>
          </div>
          <div className="btn-row">
            {pack.status === "confirmed" ? (
              <Link href={`/packs/${id}/export`} className="btn btn-primary">
                내보내기로 이동
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!allGatesChecked || confirming}
                onClick={handleConfirm}
              >
                {confirming ? "확정 중..." : "Context Pack 확정"}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
