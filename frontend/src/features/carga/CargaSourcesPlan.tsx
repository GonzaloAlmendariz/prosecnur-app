import { Database, GitMerge, Layers, Lock, Network, Split } from "../../vendor/lucide-react";
import { plannedResultBaseCount } from "./CargaSourcesModel";
import type { MultiBaseStrategy } from "./store";

const STRATEGY_COPY: Record<MultiBaseStrategy, { label: string; detail: string }> = {
  separate: {
    label: "Bases separadas",
    detail: "Cada entrada conserva su formulario y sus respuestas.",
  },
  integrated: {
    label: "Base integrada",
    detail: "Las entradas compatibles terminan en una sola base con trazabilidad.",
  },
  independent: {
    label: "Hermanas independientes",
    detail: "Cada actor o encuesta conserva su propia base y entregables.",
  },
};

export function CargaSourcesPlan({
  strategy,
  single,
  plannedInputCount,
  materializedInputCount,
  disabled = false,
  onPlannedInputCountChange,
}: {
  strategy: MultiBaseStrategy;
  single: boolean;
  plannedInputCount: number;
  materializedInputCount: number;
  disabled?: boolean;
  onPlannedInputCountChange: (value: number) => void;
}) {
  const resultCount = single ? 1 : plannedResultBaseCount(strategy, plannedInputCount);
  const max = strategy === "independent" ? 10 : 16;
  const minimum = single ? 1 : Math.max(1, materializedInputCount);
  const StrategyIcon = single
    ? Database
    : strategy === "integrated"
      ? GitMerge
      : strategy === "independent"
        ? Split
        : Layers;
  const copy = single
    ? { label: "Una base", detail: "Un formulario y un conjunto de respuestas." }
    : STRATEGY_COPY[strategy];

  return (
    <section className="pulso-carga-sources-plan" aria-label="Plan operativo de Fuentes">
      <div className="pulso-carga-sources-plan-strategy" role="status">
        <span className="pulso-carga-sources-plan-icon" aria-hidden="true">
          <StrategyIcon size={16} />
        </span>
        <span>
          <small><Lock size={11} aria-hidden="true" /> Definido en Plan</small>
          <strong>{copy.label}</strong>
          <em>{copy.detail}</em>
        </span>
      </div>

      <label className="pulso-carga-sources-plan-count">
        <span>Entradas previstas</span>
        <input
          type="number"
          inputMode="numeric"
          min={minimum}
          max={single ? 1 : max}
          value={single ? 1 : plannedInputCount}
          disabled={disabled || single}
          onChange={(event) => onPlannedInputCountChange(Math.max(minimum, Number(event.target.value)))}
        />
        <small>{single ? "Cantidad fijada por el plan" : `Entre ${minimum} y ${max}`}</small>
      </label>

      <div className="pulso-carga-sources-plan-result" aria-label="Resultado previsto">
        <Network size={15} aria-hidden="true" />
        <span>
          <strong>{resultCount} {resultCount === 1 ? "base resultante" : "bases resultantes"}</strong>
          <small>{materializedInputCount}/{single ? 1 : plannedInputCount} entradas materializadas</small>
        </span>
      </div>
    </section>
  );
}
