import type { CSSProperties, KeyboardEvent } from "react";
import { ArrowRight, MoreHorizontal, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { homeModuleVars, type ProsecnurModuleMeta } from "../../lib/modules";
import type { DisenoEstudioSourceState } from "../../api/client";

export type ModuleStatusState = DisenoEstudioSourceState;

export type ModuleCardViz =
  | { kind: "phases"; done: number; total: number; labels: string[] }
  | { kind: "stat"; value: string; label: string }
  | { kind: "date"; day: string; month: string; label: string; countdown: string; tone: "future" | "today" | "overdue" | "empty" }
  | { kind: "windows"; items: string[]; label: string };

export type ModuleCardFact = { label: string; value: string };

export type ModuleCardView = {
  state: ModuleStatusState;
  viz: ModuleCardViz;
  sub: string;
  facts: ModuleCardFact[];
  alert?: string | null;
  /** Lectura del backend sobre el estado del módulo (overview.modules[].summary). */
  summary?: string;
};

function PhaseView({ done, total, labels, sub }: { done: number; total: number; labels: string[]; sub: string }) {
  return (
    <span className="home-mc-viz is-phases">
      <span className="home-mc-phasebar">
        <span className="home-mc-phase-track">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`home-mc-phase${i < done ? " is-done" : ""}${i === done ? " is-next" : ""}`} title={labels[i]} />
          ))}
        </span>
        <span className="home-mc-phase-labels">
          {labels.map((label, i) => (
            <span key={label} className={i < done ? "is-done" : ""}>{label}</span>
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

function StatView({ value, label, sub }: { value: string; label: string; sub: string }) {
  const isWord = /[a-zá-úñ]/i.test(value);
  return (
    <span className="home-mc-viz">
      <span className={`home-mc-stat is-hero${value === "—" ? " is-empty" : ""}${isWord ? " is-text" : ""}`}>
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
        <span className="home-mc-daychip-month">{viz.month}</span>
        <span className="home-mc-daychip-day">{viz.day}</span>
      </span>
      <span className="home-mc-stat">
        <span className="home-mc-stat-label">{viz.label}</span>
        <span className="home-mc-date-title">{sub}</span>
        <span className={`home-mc-countdown is-${viz.tone}`}>{viz.countdown}</span>
      </span>
    </span>
  );
}

function WindowsView({ items, label, sub }: { items: string[]; label: string; sub: string }) {
  return (
    <span className="home-mc-viz is-windows">
      <span className="home-mc-windows">
        {items.map((item) => (
          <span key={item} className="home-mc-window">{item}</span>
        ))}
      </span>
      <span className="home-mc-stat-meta">
        <span className="home-mc-stat-label">{label}</span>
        <span className="home-mc-stat-sub">{sub}</span>
      </span>
    </span>
  );
}

// Tarjeta de módulo: marca de agua branded del ícono, indicador hero del
// dominio, franja de facts con las cifras que se consultan antes de entrar,
// y flecha de acceso. Quitar el módulo pide confirmación (kebab).
export function ModuleStatusCard({
  module,
  view,
  index,
  onRequestRemove,
}: {
  module: ProsecnurModuleMeta;
  view: ModuleCardView;
  index: number;
  onRequestRemove: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const Icon = module.icon;
  const to = module.to;

  function enter() {
    if (to) navigate(to);
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      enter();
    }
  }

  return (
    <div
      className={`home-mc-card is-${view.state}`}
      style={{ ...homeModuleVars(module), ["--i" as string]: index } as CSSProperties}
      role="button"
      tabIndex={0}
      onClick={enter}
      onKeyDown={onKey}
      title={view.summary || undefined}
      aria-label={module.title}
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
        <span className="home-mc-head-actions">
          {/* Sin chip de estado: los módulos son herramientas, no fases que se
              completan — los datos del cuerpo son el reporte. Solo se señala
              cuando hay algo que revisar. */}
          {view.alert && (
            <span className="home-mc-alert" title={view.alert}>
              <TriangleAlert size={11} strokeWidth={2.6} aria-hidden="true" />
              {view.alert}
            </span>
          )}
          <button
            type="button"
            className="home-mc-kebab"
            aria-label={`Opciones de ${module.shortLabel}`}
            title="Opciones"
            onClick={(event) => {
              event.stopPropagation();
              onRequestRemove(module.slug);
            }}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </span>
      </span>

      {view.viz.kind === "phases" && (
        <PhaseView done={view.viz.done} total={view.viz.total} labels={view.viz.labels} sub={view.sub} />
      )}
      {view.viz.kind === "stat" && <StatView value={view.viz.value} label={view.viz.label} sub={view.sub} />}
      {view.viz.kind === "date" && <DateView viz={view.viz} sub={view.sub} />}
      {view.viz.kind === "windows" && <WindowsView items={view.viz.items} label={view.viz.label} sub={view.sub} />}

      <span className="home-mc-foot">
        {/* Solo facts con dato: una herramienta sin actividad no reporta
            guiones, simplemente aún no tiene nada que decir. */}
        {view.facts.some((fact) => fact.value !== "—") && (
          <span className="home-mc-facts" aria-label={`Datos de ${module.shortLabel}`}>
            {view.facts.filter((fact) => fact.value !== "—").slice(0, 3).map((fact) => (
              <span className="home-mc-fact" key={fact.label}>
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </span>
            ))}
          </span>
        )}
        <span className="home-mc-cta" aria-hidden="true">
          <span>Entrar</span>
          <span className="home-mc-cta-arrow"><ArrowRight size={14} /></span>
        </span>
      </span>
    </div>
  );
}
