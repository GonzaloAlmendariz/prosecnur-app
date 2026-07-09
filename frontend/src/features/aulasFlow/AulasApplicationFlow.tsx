import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  CalendarRange,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  QrCode,
  Target,
} from "lucide-react";
import { MODULE_TONES, type ProsecnurModuleSlug } from "../../lib/modules";
import "./aulasFlow.css";

export const AULAS_SAMPLE_ROUTE = "/calc-muestra?mesa=aulas";

export type AulasFlowStep = "muestra" | "qr" | "pdf" | "monitoreo";

export type AulasFlowMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "ready" | "warning" | "current";
};

type AulasFlowAction = {
  label: string;
  to: string;
  disabled?: boolean;
};

type AulasApplicationFlowProps = {
  current: AulasFlowStep;
  tone: ProsecnurModuleSlug;
  title: string;
  summary: string;
  metrics?: AulasFlowMetric[];
  action?: AulasFlowAction;
  secondaryAction?: AulasFlowAction;
  showEngineOutputs?: boolean;
  compact?: boolean;
};

const STEPS: Array<{
  id: AulasFlowStep;
  label: string;
  detail: string;
  icon: typeof Target;
}> = [
  { id: "muestra", label: "Muestra de aulas", detail: "titulares y reservas", icon: Target },
  { id: "qr", label: "Kobo + QR", detail: "enlace personalizado", icon: QrCode },
  { id: "pdf", label: "Fichas PDF/Word", detail: "individual y consolidado", icon: FileText },
  { id: "monitoreo", label: "Monitoreo de aulas", detail: "avance y caídas", icon: CalendarRange },
];

const NOTEBOOK_OUTPUTS = [
  "QR individual",
  "Ficha Word",
  "Ficha PDF",
  "Consolidado por selección",
  "Tabla de enlaces",
];

function stepTone(step: AulasFlowStep, current: AulasFlowStep) {
  const currentIndex = STEPS.findIndex((item) => item.id === current);
  const stepIndex = STEPS.findIndex((item) => item.id === step);
  if (stepIndex < currentIndex) return "ready";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

function FlowAction({ action, secondary = false }: { action: AulasFlowAction; secondary?: boolean }) {
  const className = `aulas-flow-action${secondary ? " is-secondary" : ""}${action.disabled ? " is-disabled" : ""}`;
  if (action.disabled) {
    return <span className={className}>{action.label}</span>;
  }
  return <Link className={className} to={action.to}>{action.label}</Link>;
}

export function AulasApplicationFlow({
  current,
  tone,
  title,
  summary,
  metrics = [],
  action,
  secondaryAction,
  showEngineOutputs = false,
  compact = false,
}: AulasApplicationFlowProps) {
  return (
    <section
      className={`aulas-flow${compact ? " is-compact" : ""}`}
      style={MODULE_TONES[tone] as CSSProperties}
      aria-label="Flujo operativo de aplicación en aulas"
    >
      {/* Wrapper interno: .aulas-flow es query container (inline-size) y el
          layout de columnas vive aquí para responder al ancho real del
          contenedor (rail angosto de Sustento técnico incluido). */}
      <div className="aulas-flow-grid">
      <div className="aulas-flow-copy">
        <span>Aplicación en aulas</span>
        <strong>{title}</strong>
        <p>{summary}</p>
      </div>

      <ol className="aulas-flow-steps">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const toneClass = stepTone(step.id, current);
          return (
            <li key={step.id} className={`is-${toneClass}`}>
              <span>{toneClass === "ready" ? <CheckCircle2 size={13} /> : index + 1}</span>
              <Icon size={15} />
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          );
        })}
      </ol>

      {metrics.length || action || secondaryAction ? (
        <div className="aulas-flow-meta">
          {metrics.length ? (
            <div className="aulas-flow-metrics">
              {metrics.map((metric) => (
                <span key={metric.label} className={`is-${metric.tone ?? "neutral"}`}>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
          {(action || secondaryAction) ? (
            <div className="aulas-flow-actions">
              {secondaryAction ? <FlowAction action={secondaryAction} secondary /> : null}
              {action ? <FlowAction action={action} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEngineOutputs ? (
        <div className="aulas-flow-engine" aria-label="Salidas del motor de fichas QR y PDF">
          <FileSpreadsheet size={14} />
          <span>Salidas del motor</span>
          {NOTEBOOK_OUTPUTS.map((output) => <span key={output} className="aulas-flow-output-chip">{output}</span>)}
        </div>
      ) : null}
      </div>
    </section>
  );
}
