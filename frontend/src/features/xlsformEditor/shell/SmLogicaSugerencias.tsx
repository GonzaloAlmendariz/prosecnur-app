import { useId, useState } from "react";
import { CheckCircle2, Info, Lightbulb } from "../../../vendor/lucide-react";
import type { SurveyMonkeyVisualLogicRule } from "../../../api/multiIntegrado";
import type { SmSugerenciaLogica } from "../../../api/xlsformSmSugerencias";
import type { VisualLogicQuestion } from "./RuleWizard";
import { claveSugerencia, sugerenciaYaAplicada, textoSugerencia } from "./smImportModel";
import "../styles/xfSmImport";

// Aviso honesto de la sección de lógica (H4/U7) y las sugerencias del servidor
// como tarjetas. Ninguna se aplica sola: «Aplicar» crea la regla en la lógica
// visual que el analista ya usa; «Descartar» la oculta mientras dure el diálogo.
// C1: `xlsform-import-sm-sugerencias`, `equal`.

export type EstadoSugerenciasSm =
  | { fase: "inactivo" }
  | { fase: "cargando" }
  | { fase: "listo"; aviso: string; sugerencias: SmSugerenciaLogica[] }
  | { fase: "error"; aviso: string };

/** Con saltos ya agregados, el aviso dice lo que sigue siendo verdad. */
export const AVISO_LOGICA_SM_CON_SALTOS =
  "SurveyMonkey no comparte su lógica por la API: revisa que los saltos agregados aquí estén completos.";

export const AVISO_LOGICA_SM =
  "SurveyMonkey no comparte la lógica de saltos por su API: el formulario se importa sin saltos.";

export function SmLogicaSugerencias({
  estado,
  saltos,
  questions,
  visualRules,
  visualPending,
  descartadas,
  onAplicar,
  onDescartar,
}: {
  estado: EstadoSugerenciasSm;
  /** Saltos ya configurados (visuales + reglas pegadas). */
  saltos: number;
  questions: VisualLogicQuestion[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  visualPending: boolean;
  descartadas: ReadonlySet<string>;
  /** Devuelve el motivo si no se pudo aplicar; `null` si quedó aplicada. */
  onAplicar: (sugerencia: SmSugerenciaLogica) => string | null;
  onDescartar: (sugerencia: SmSugerenciaLogica) => void;
}) {
  const [errores, setErrores] = useState<Record<string, string>>({});
  const prefijo = useId();
  if (estado.fase === "inactivo") return null;
  const conSaltos = saltos > 0;
  const aviso = conSaltos
    ? AVISO_LOGICA_SM_CON_SALTOS
    : estado.fase === "listo" || estado.fase === "error" ? estado.aviso : AVISO_LOGICA_SM;
  const sugerencias = estado.fase === "listo"
    ? estado.sugerencias.filter((s) => !descartadas.has(claveSugerencia(s)))
    : [];

  return (
    <div className="pulso-xf-smi-logica">
      <p className={`pulso-xf-smi-aviso${conSaltos ? " is-neutro" : ""}`} role="note">
        <Info size={15} aria-hidden />
        <span>{aviso}</span>
      </p>
      {estado.fase === "cargando" ? (
        <p className="pulso-xf-smi-sug-cargando" aria-live="polite">Buscando saltos evidentes en la encuesta…</p>
      ) : null}
      {sugerencias.length ? (
        <ul
          className="pulso-xf-smi-sugerencias"
          aria-label="Sugerencias de lógica"
          data-qa-geometry-group="xlsform-import-sm-sugerencias"
          data-qa-geometry-contract="equal"
        >
          {sugerencias.map((sugerencia) => {
            const clave = claveSugerencia(sugerencia);
            const aplicada = sugerenciaYaAplicada(visualRules, questions, sugerencia);
            const error = errores[clave];
            const titulo = textoSugerencia(sugerencia);
            return (
              <li
                key={clave}
                id={`${prefijo}-${clave}`}
                tabIndex={-1}
                className={`pulso-xf-smi-sugerencia${aplicada ? " is-aplicada" : ""}`}
                data-qa-geometry-member=""
              >
                <span className="pulso-xf-smi-sugerencia-icono" aria-hidden>
                  {aplicada ? <CheckCircle2 size={16} /> : <Lightbulb size={16} />}
                </span>
                <div className="pulso-xf-smi-sugerencia-texto">
                  <span className="pulso-xf-smi-eyebrow">{aplicada ? "Sugerencia aplicada" : "Sugerencia"}</span>
                  <strong title={sugerencia.etiqueta}>{titulo}</strong>
                  {aplicada ? (
                    <small>La regla ya está en la lógica visual de abajo; puedes cambiarla ahí.</small>
                  ) : sugerencia.motivo ? (
                    <small>{sugerencia.motivo}</small>
                  ) : null}
                  {!aplicada && visualPending ? (
                    <small className="is-alerta">Confirma o descarta los cambios pendientes de la lógica visual antes de aplicarla.</small>
                  ) : null}
                  {error ? <small className="is-error" role="alert">{error}</small> : null}
                </div>
                {!aplicada ? (
                  <div className="pulso-xf-smi-sugerencia-acciones">
                    <button
                      type="button"
                      className="pulso-primary"
                      disabled={visualPending}
                      aria-label={`Aplicar: ${titulo}`}
                      onClick={() => {
                        const motivo = onAplicar(sugerencia);
                        // El botón desaparece al aplicarse: el foco pasa a la
                        // tarjeta, que ahora dice «Sugerencia aplicada».
                        if (!motivo) {
                          window.requestAnimationFrame(() => {
                            document.getElementById(`${prefijo}-${clave}`)?.focus();
                          });
                        }
                        setErrores((prev) => {
                          const next = { ...prev };
                          if (motivo) next[clave] = motivo;
                          else delete next[clave];
                          return next;
                        });
                      }}
                    >
                      Aplicar
                    </button>
                    <button
                      type="button"
                      aria-label={`Descartar: ${titulo}`}
                      onClick={() => onDescartar(sugerencia)}
                    >
                      Descartar
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
