import { PageFrame } from "../../components/PageFrame";
import { ArrowRight, Loader2 } from "../../vendor/lucide-react";
import {
  MONITOREO_MODOS,
  type MonitoreoModo,
  type MonitoreoModoDefinicion,
} from "./core/monitoreoRegistry";

type MonitoreoModeChoiceProps = {
  modes?: MonitoreoModoDefinicion[];
  busyFamily?: MonitoreoModo | null;
  error?: string;
  onChoose: (mode: MonitoreoModoDefinicion) => void;
};

export function MonitoreoModeChoice({
  modes = MONITOREO_MODOS,
  busyFamily = null,
  error = "",
  onChoose,
}: MonitoreoModeChoiceProps) {
  const availableModes = modes.filter((mode) => mode.status === "active");

  return (
    <PageFrame
      title="¿Qué tipo de estudio vas a monitorear?"
      lead="Elige el modo que corresponde al diseño del estudio. Esta decisión configura las secciones, fuentes y reglas operativas de Monitoreo."
      className="mon-mode-choice-frame"
      layout="document"
      density="compact"
      auditReady="monitoreo-mode-choice"
    >
      <div className="mon-mode-choice">
        <div className="mon-mode-choice__intro">
          <span className="pulso-section-eyebrow">Configuración inicial</span>
          <strong>Declara el propósito de Monitoreo</strong>
          <p>
            Pulso guardará esta elección en el proyecto. Las opciones específicas de
            acreditación solo aparecerán cuando elijas ese modo.
          </p>
        </div>

        <div
          className="mon-mode-choice__grid"
          aria-label="Modos de Monitoreo disponibles"
          data-qa-geometry-group="monitoring-mode-options"
          data-qa-geometry-contract="equal"
        >
          {availableModes.map((mode) => {
            const Icon = mode.icon;
            const choosing = busyFamily === mode.family;
            return (
              <button
                key={mode.family}
                type="button"
                className="mon-mode-choice__option"
                onClick={() => onChoose(mode)}
                disabled={busyFamily !== null}
                aria-busy={choosing || undefined}
                data-qa-geometry-member
              >
                <span className="mon-mode-choice__icon" aria-hidden="true">
                  {choosing ? <Loader2 size={19} className="pulso-spin" /> : <Icon size={19} />}
                </span>
                <span className="mon-mode-choice__copy" data-qa-geometry-content>
                  <strong>{mode.label}</strong>
                  <span>{mode.summary}</span>
                </span>
                <span className="mon-mode-choice__action" aria-hidden="true">
                  {choosing ? "Guardando…" : "Elegir"}
                  {!choosing && <ArrowRight size={14} />}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mon-mode-choice__error" role="alert">
            <strong>No se pudo guardar la elección.</strong>
            <span>{error}</span>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
