import { forwardRef, type CSSProperties } from "react";
import { ArrowRight, MoreHorizontal, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { homeModuleVars, type ProsecnurModuleMeta } from "../../lib/modules";
import type { ModuleCardView, ModuleCardViz } from "./moduleCardModel";

export type {
  ModuleCardFact,
  ModuleCardView,
  ModuleCardViz,
  ModuleProgressStep,
  ModuleStatusState,
} from "./moduleCardModel";

function PhaseView({
  done,
  total,
  labels,
  sub,
}: {
  done: number;
  total: number;
  labels: string[];
  sub: string;
}) {
  return (
    <span className="home-mc-viz is-phases">
      <span className="home-mc-phasebar">
        <span className="home-mc-phase-track">
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={index}
              className={`home-mc-phase${index < done ? " is-done" : ""}${index === done ? " is-next" : ""}`}
              title={labels[index]}
            />
          ))}
        </span>
        <span className="home-mc-phase-labels">
          {labels.map((label, index) => (
            <span key={label} className={index < done ? "is-done" : ""}>
              {label}
            </span>
          ))}
        </span>
      </span>
      <span className="home-mc-stat is-inline">
        <strong>{done}/{total}</strong>
        <span className="home-mc-stat-meta">
          <span className="home-mc-stat-label">fases</span>
          <span className="home-mc-stat-sub">{sub}</span>
        </span>
      </span>
    </span>
  );
}

function ProgressView({
  viz,
  sub,
}: {
  viz: Extract<ModuleCardViz, { kind: "progress" }>;
  sub: string;
}) {
  const percent = viz.total > 0
    ? Math.min(100, Math.max(0, (viz.current / viz.total) * 100))
    : 0;
  return (
    <span className="home-mc-viz is-progress">
      <span className="home-mc-activity">
        <span>Ahora</span>
        <strong>{sub}</strong>
      </span>
      <span className="home-mc-progress-row">
        <span
          className="home-mc-progress-track"
          role="progressbar"
          aria-label={viz.label}
          aria-valuemin={0}
          aria-valuemax={viz.total}
          aria-valuenow={Math.min(viz.current, viz.total)}
        >
          <span className="home-mc-progress-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="home-mc-progress-copy">
          <strong>{viz.display}</strong>
          <span>{viz.label}</span>
        </span>
      </span>
      {viz.steps && (
        <span className="home-mc-progress-steps" aria-hidden="true">
          {viz.steps.map((step) => (
            <span key={step.label} className={`is-${step.state}`}>{step.label}</span>
          ))}
        </span>
      )}
    </span>
  );
}

function StatView({
  value,
  label,
  sub,
  activityFirst,
}: {
  value: string;
  label: string;
  sub: string;
  activityFirst: boolean;
}) {
  const isWord = /[a-zá-úñ]/i.test(value);
  if (activityFirst) {
    return (
      <span className="home-mc-viz is-activity">
        <span className="home-mc-activity">
          <span>Ahora</span>
          <strong>{sub}</strong>
        </span>
        <span className="home-mc-secondary-stat">
          <strong>{value}</strong>
          <span>{label}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="home-mc-viz">
      <span className={`home-mc-stat is-hero${isWord ? " is-text" : ""}`}>
        <strong>{value}</strong>
        <span className="home-mc-stat-meta">
          <span className="home-mc-stat-label">{label}</span>
          <span className="home-mc-stat-sub">{sub}</span>
        </span>
      </span>
    </span>
  );
}

function DateView({ viz, sub }: { viz: Extract<ModuleCardViz, { kind: "date" }>; sub: string }) {
  return (
    <span className="home-mc-viz">
      <span className={`home-mc-daychip is-${viz.tone}`} aria-hidden="true">
        <span className="home-mc-daychip-month">{viz.month || "fecha"}</span>
        <span className="home-mc-daychip-day">{viz.day || "?"}</span>
      </span>
      <span className="home-mc-stat">
        <span className="home-mc-stat-label">{viz.label}</span>
        <span className="home-mc-date-title">{sub}</span>
        <span className={`home-mc-countdown is-${viz.tone}`}>{viz.countdown}</span>
      </span>
    </span>
  );
}

export const ModuleStatusCard = forwardRef<
  HTMLDivElement,
  {
    module: ProsecnurModuleMeta;
    view: ModuleCardView;
    index: number;
    onRequestRemove: (slug: string) => void;
  }
>(function ModuleStatusCard({ module, view, index, onRequestRemove }, ref) {
  const navigate = useNavigate();
  const Icon = module.icon;

  return (
    <div
      ref={ref}
      className={`home-mc-card is-${view.state}`}
      style={{ ...homeModuleVars(module), ["--i" as string]: index } as CSSProperties}
      title={view.summary || undefined}
    >
      <button
        type="button"
        className="home-mc-enter"
        onClick={() => navigate(view.action.route)}
        aria-label={`${view.action.label}: ${module.title}`}
      >
        <Icon className="home-mc-watermark" aria-hidden="true" strokeWidth={1.4} />

        <span className="home-mc-head">
          <span className="home-mc-head-id">
            <span className="home-mc-badge" aria-hidden="true"><Icon size={17} /></span>
            <span className="home-mc-head-text">
              <strong>{module.shortLabel}</strong>
              <span className="home-mc-tagline">{module.tagline}</span>
            </span>
          </span>
          <span className="home-mc-signals">
            <span className={`home-mc-status is-${view.state}`}>{view.statusLabel}</span>
            {view.alert && (
              <span className="home-mc-alert" title={view.alert}>
                <TriangleAlert size={11} strokeWidth={2.6} aria-hidden="true" />
                {view.alert}
              </span>
            )}
          </span>
        </span>

        {view.viz.kind === "phases" && (
          <PhaseView
            done={view.viz.done}
            total={view.viz.total}
            labels={view.viz.labels}
            sub={view.sub}
          />
        )}
        {view.viz.kind === "progress" && <ProgressView viz={view.viz} sub={view.sub} />}
        {view.viz.kind === "stat" && (
          <StatView
            value={view.viz.value}
            label={view.viz.label}
            sub={view.sub}
            activityFirst={view.emphasis === "activity"}
          />
        )}
        {view.viz.kind === "date" && <DateView viz={view.viz} sub={view.sub} />}

        <span className="home-mc-foot">
          {view.facts.length > 0 && (
            <span className="home-mc-facts" aria-label={`Datos de ${module.shortLabel}`}>
              {view.facts.slice(0, 4).map((fact) => (
                <span className="home-mc-fact" key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </span>
              ))}
            </span>
          )}
          <span className="home-mc-cta" aria-hidden="true">
            <span>{view.action.label}</span>
            <span className="home-mc-cta-arrow"><ArrowRight size={14} /></span>
          </span>
        </span>
      </button>

      <button
        type="button"
        className="home-mc-kebab"
        aria-label={`Opciones de ${module.shortLabel}`}
        title="Opciones"
        onClick={() => onRequestRemove(module.slug)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
    </div>
  );
});
