import { Fragment } from "react";

export type StepKey = "upload" | "analysis" | "review" | "export";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "upload", label: "업로드" },
  { key: "analysis", label: "분석" },
  { key: "review", label: "검토" },
  { key: "export", label: "내보내기" },
];

/** 전체 4단계 흐름에서 현재 위치를 보여주는 스테퍼. */
export function Stepper({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="stepper-outer">
      <nav className="stepper-track" aria-label="진행 단계">
        {STEPS.map((step, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "";
          return (
            <Fragment key={step.key}>
              {i > 0 && (
                <span className={`step-connector${i <= currentIdx ? " done" : ""}`} />
              )}
              <div
                className={`step-btn${state ? ` ${state}` : ""}`}
                aria-current={i === currentIdx ? "step" : undefined}
              >
                <span className="step-circle">{i < currentIdx ? "✓" : i + 1}</span>
                <span className="step-label">{step.label}</span>
              </div>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}
