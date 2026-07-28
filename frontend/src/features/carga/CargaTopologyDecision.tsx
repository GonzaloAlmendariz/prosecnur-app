import {
  Check,
  Database,
  GitMerge,
  Layers,
  Lock,
  Network,
  Split,
} from "../../vendor/lucide-react";
import type {
  CargaTopologyIntent,
  CargaTopologyResolution,
} from "./CargaTopologyModel";
import type { MultiBaseStrategy } from "./store";

type StrategyCopy = {
  label: string;
  meaning: string;
  when: string;
  result: string;
  Icon: typeof Layers;
};

const STRATEGIES: Array<MultiBaseStrategy> = ["separate", "integrated", "independent"];

const STRATEGY_COPY: Record<MultiBaseStrategy, StrategyCopy> = {
  separate: {
    label: "Bases separadas",
    meaning: "Cada fuente conserva su propio formulario y sus respuestas; cada base mantiene su identidad y sus datos, sin fusión obligatoria.",
    when: "Cuando los públicos o instrumentos se analizan por separado.",
    result: "En Gráficos puedes crear reportes independientes por base e informes conjuntos que combinan resultados de varias bases.",
    Icon: Layers,
  },
  integrated: {
    label: "Base integrada",
    meaning: "Fuentes compatibles se reúnen con un formulario guía común.",
    when: "Cuando comparten preguntas y deben leerse como un solo conjunto.",
    result: "Una base unificada que conserva el origen.",
    Icon: GitMerge,
  },
  independent: {
    label: "Hermanas independientes",
    meaning: "Encuestas distintas comparten reglas, pero sus datos no se mezclan.",
    when: "Cuando cada encuesta o público necesita su propio entregable.",
    result: "Bases hermanas procesadas de forma independiente.",
    Icon: Split,
  },
};

function selectedStrategy(resolution: CargaTopologyResolution, intent: CargaTopologyIntent) {
  if (resolution.strategy) return resolution.strategy;
  return STRATEGIES.find((strategy) => strategy === intent) ?? null;
}

export function CargaTopologyDecision({
  resolution,
  intent,
  disabled,
  onIntentChange,
}: {
  resolution: CargaTopologyResolution;
  intent: CargaTopologyIntent;
  disabled: boolean;
  onIntentChange: (intent: CargaTopologyIntent) => void;
}) {
  const modeDisabled = disabled || resolution.modeLocked;
  const strategyDisabled = disabled || resolution.strategyLocked;
  const strategy = selectedStrategy(resolution, intent);
  const showStrategies = resolution.mode === "multi" || intent === "multi" || strategy !== null;

  return (
    <div className="pulso-carga-topology-decision">
      <fieldset
        className="pulso-carga-topology-mode"
        disabled={modeDisabled}
        aria-describedby={resolution.lockReason ? "carga-topology-lock" : undefined}
      >
        <legend>¿Cuántas bases organizará el estudio?</legend>
        <div className="pulso-carga-topology-mode-gallery">
          <label className={resolution.mode === "single" ? "is-selected" : ""}>
            <input
              type="radio"
              name="carga-topology-mode"
              value="single"
              checked={resolution.mode === "single"}
              onChange={() => onIntentChange("single")}
            />
            <span className="pulso-carga-topology-option-icon" aria-hidden="true">
              <Database size={17} />
            </span>
            <span className="pulso-carga-topology-option-copy">
              <strong>Una base</strong>
              <small>Un formulario y un conjunto de respuestas.</small>
            </span>
            {resolution.mode === "single" && (
              <span className="pulso-carga-topology-selected"><Check size={12} /> Elegida</span>
            )}
          </label>
          <label className={resolution.mode === "multi" ? "is-selected" : ""}>
            <input
              type="radio"
              name="carga-topology-mode"
              value="multi"
              checked={resolution.mode === "multi"}
              onChange={() => onIntentChange(strategy ?? "multi")}
            />
            <span className="pulso-carga-topology-option-icon" aria-hidden="true">
              <Network size={17} />
            </span>
            <span className="pulso-carga-topology-option-copy">
              <strong>Varias bases</strong>
              <small>Dos o más fuentes con una organización explícita.</small>
            </span>
            {resolution.mode === "multi" && (
              <span className="pulso-carga-topology-selected"><Check size={12} /> Elegida</span>
            )}
          </label>
        </div>
      </fieldset>

      {showStrategies && (
        <fieldset
          className="pulso-carga-topology-strategies"
          disabled={strategyDisabled}
          aria-describedby={resolution.lockReason ? "carga-topology-lock" : undefined}
        >
          <legend>¿Cómo se relacionan esas bases?</legend>
          <div className="pulso-carga-topology-strategy-gallery">
            {STRATEGIES.map((key) => {
              const copy = STRATEGY_COPY[key];
              const Icon = copy.Icon;
              const selected = strategy === key;
              return (
                <label key={key} className={selected ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="carga-topology-strategy"
                    value={key}
                    checked={selected}
                    onChange={() => onIntentChange(key)}
                  />
                  <span className="pulso-carga-topology-option-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="pulso-carga-topology-option-copy">
                    <strong>{copy.label}</strong>
                    <small>{copy.meaning}</small>
                    <span><b>Úsala:</b> {copy.when}</span>
                    <span><b>Resultado:</b> {copy.result}</span>
                  </span>
                  {selected && (
                    <span className="pulso-carga-topology-selected"><Check size={12} /> Elegida</span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {resolution.lockReason && (
        <p
          id="carga-topology-lock"
          className={`pulso-carga-topology-lock${resolution.status === "conflict" ? " is-conflict" : ""}`}
          role={resolution.status === "conflict" ? "alert" : "status"}
        >
          <Lock size={13} aria-hidden="true" />
          {resolution.lockReason}
        </p>
      )}

      <p className="pulso-carga-topology-method-note">
        La acreditación se declara en Monitoreo. Los grupos repetidos se derivan del formulario y no son una estrategia de bases.
      </p>
    </div>
  );
}
