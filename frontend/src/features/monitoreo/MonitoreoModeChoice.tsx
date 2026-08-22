import { PageFrame } from "../../components/PageFrame";
import { ArrowRight, Loader2 } from "../../vendor/lucide-react";
import {
  MONITOREO_MODOS,
  type MonitoreoModo,
  type MonitoreoModoDefinicion,
} from "./core/monitoreoRegistry";
import type { SugerenciaDeModo } from "./core/sugerenciaDeModo";

type MonitoreoModeChoiceProps = {
  modes?: MonitoreoModoDefinicion[];
  busyFamily?: MonitoreoModo | null;
  error?: string;
  /** Modo que corresponde a lo que el proyecto ya tiene. Marca una tarjeta con
      su motivo; no preselecciona ni deshabilita las demás. */
  sugerencia?: SugerenciaDeModo | null;
  onChoose: (mode: MonitoreoModoDefinicion) => void;
};

export function MonitoreoModeChoice({
  modes = MONITOREO_MODOS,
  busyFamily = null,
  error = "",
  sugerencia = null,
  onChoose,
}: MonitoreoModeChoiceProps) {
  const availableModes = modes.filter((mode) => mode.status === "active");
  const sugerida = sugerencia && availableModes.some((m) => m.family === sugerencia.family)
    ? sugerencia
    : null;

  return (
    <PageFrame
      title="¿Qué tipo de estudio vas a monitorear?"
      lead={
        sugerida
          ? `${sugerida.motivo} Puedes seguir esa lectura o elegir otro modo.`
          : "Elige el modo que corresponde al diseño del estudio. Esta decisión configura las secciones, fuentes y reglas operativas de Monitoreo."
      }
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
            const esSugerida = sugerida?.family === mode.family;
            return (
              <button
                key={mode.family}
                type="button"
                className={`mon-mode-choice__option${esSugerida ? " mon-mode-choice__option--sugerida" : ""}`}
                data-sugerida={esSugerida || undefined}
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
                {/* La marca va en la columna de acción, no junto al label: ahí
                    no compite con títulos largos. Medido a 1024px, colgada del
                    label envolvía a segunda línea y dejaba el contenido en 71px
                    de los 72 disponibles — cabía por un píxel, que no es caber.
                    El motivo con su cifra vive en el lead, porque una tercera
                    línea dentro de la tarjeta rompería el alto fijo de 96px y
                    con él el grupo `equal`. */}
                <span className="mon-mode-choice__action" aria-hidden="true">
                  {esSugerida && (
                    <em className="mon-mode-choice__marca">Sugerido</em>
                  )}
                  <span className="mon-mode-choice__cta">
                    {choosing ? "Guardando…" : "Elegir"}
                    {!choosing && <ArrowRight size={14} />}
                  </span>
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
