// Campañas complementarias declaradas en la tarjeta de un formulario (ADR 0101).
//
// Sólo se pinta si hay alguna (C3: sin campañas no queda una caja vacía).
// «Quitar» pide confirmación aunque declarar de nuevo la recupere.
//
// C2: es un chip en la fila de métricas y el detalle se abre como popover
// sobre la tarjeta. Así 0, 1 o 3 campañas no cambian el alto de la tarjeta, y
// con la grilla pareja tampoco el de las otras cinco.

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Layers, X } from "../../../vendor/lucide-react";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { apiCampanaQuitar, type CampanaDeclarada } from "../../../api/xlsformCampanas";
import { resumenCampanas } from "./campanaComplementariaModel";
import "../styles/xfCampana";

type EstadoQuitar =
  | { fase: "reposo"; error: string }
  | { fase: "confirmar"; surveyId: string }
  | { fase: "quitando"; surveyId: string };

export type CampanasDeclaradasProps = {
  formId: string;
  formName: string;
  campanas: readonly CampanaDeclarada[];
  onCambio?: (formId: string) => void;
  /** Arranca con el detalle abierto (pruebas y enlaces de revisión). */
  abiertoInicial?: boolean;
};

/** «73/74»: el calce, corto, para que el bloque quepa en una línea. */
function calceCampana(campana: CampanaDeclarada): string {
  if (campana.n_emparejadas == null || campana.n_preguntas_base == null) return "";
  return `${campana.n_emparejadas}/${campana.n_preguntas_base}`;
}

function descripcionCampana(campana: CampanaDeclarada, titulo: string): string {
  const partes = [titulo, `ID ${campana.survey_id}`];
  if (campana.n_emparejadas != null && campana.n_preguntas_base != null) {
    partes.push(`calzan ${campana.n_emparejadas} de ${campana.n_preguntas_base} campos`);
  }
  return partes.join(" · ");
}

export function CampanasDeclaradas({
  formId,
  formName,
  campanas,
  onCambio,
  abiertoInicial = false,
}: CampanasDeclaradasProps) {
  const [quitar, setQuitar] = useState<EstadoQuitar>({ fase: "reposo", error: "" });
  const [abierto, setAbierto] = useState(abiertoInicial);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const disparadorRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!abierto) return;
    function fuera(event: MouseEvent) {
      if (raizRef.current && !raizRef.current.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  if (campanas.length === 0) return null;

  function cerrar() {
    setAbierto(false);
    setQuitar((previo) => (previo.fase === "confirmar" ? { fase: "reposo", error: "" } : previo));
    requestAnimationFrame(() => disparadorRef.current?.focus());
  }

  async function confirmarQuitar(surveyId: string) {
    setQuitar({ fase: "quitando", surveyId });
    try {
      await apiCampanaQuitar(formId, surveyId);
      setQuitar({ fase: "reposo", error: "" });
      onCambio?.(formId);
    } catch (e) {
      const crudo = e instanceof Error ? e.message : String(e);
      setQuitar({ fase: "reposo", error: splitErrorDetail(crudo).message || "No se pudo quitar la campaña." });
    }
  }

  return (
    <div
      ref={raizRef}
      className="pulso-xf-home-card-campanas-ancla"
      onKeyDown={(event) => {
        if (event.key === "Escape" && abierto) {
          event.stopPropagation();
          cerrar();
        }
      }}
    >
      <button
        ref={disparadorRef}
        type="button"
        className="pulso-xf-home-card-campanas-chip"
        aria-expanded={abierto}
        aria-controls={abierto ? popoverId : undefined}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        <Layers size={12} aria-hidden="true" /> {resumenCampanas(campanas.length)}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {abierto ? (
    <section id={popoverId} className="pulso-xf-home-card-campanas" aria-label={`Campañas de ${formName}`}>
      <span className="pulso-xf-home-card-campanas-resumen">
        Encuestas que se leen con este formulario
      </span>
      <ul>
        {campanas.map((campana) => {
          const enConfirmacion = quitar.fase === "confirmar" && quitar.surveyId === campana.survey_id;
          const quitando = quitar.fase === "quitando" && quitar.surveyId === campana.survey_id;
          const titulo = campana.survey_title || "Encuesta sin título";
          return (
            <li key={campana.survey_id}>
              <span className="pulso-xf-home-card-campana-texto" title={descripcionCampana(campana, titulo)}>
                <strong>{titulo}</strong>
                {calceCampana(campana) ? (
                  <small>
                    {calceCampana(campana)}
                    <span className="pulso-sr-only"> preguntas calzan · ID {campana.survey_id}</span>
                  </small>
                ) : null}
              </span>
              {enConfirmacion ? (
                <span className="pulso-xf-home-card-campana-confirmar" role="group" aria-label={`Confirmar quitar ${titulo}`}>
                  <button type="button" onClick={() => setQuitar({ fase: "reposo", error: "" })}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    autoFocus
                    onClick={() => { void confirmarQuitar(campana.survey_id); }}
                  >
                    Quitar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="pulso-xf-home-card-campana-quitar"
                  disabled={quitar.fase === "quitando"}
                  aria-label={`Quitar la campaña ${titulo}`}
                  onClick={() => setQuitar({ fase: "confirmar", surveyId: campana.survey_id })}
                >
                  {quitando ? "Quitando…" : <X size={13} aria-hidden="true" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {quitar.fase === "confirmar" ? (
        <small className="pulso-xf-home-card-campanas-nota">
          Sus respuestas dejarán de leerse con este formulario. Puedes volver a agregarla cuando quieras.
        </small>
      ) : null}
      {quitar.fase === "reposo" && quitar.error ? (
        <small className="pulso-xf-home-card-campanas-error" role="alert">{quitar.error}</small>
      ) : null}
    </section>
      ) : null}
      {/* El error de quitar se ve aunque el popover se haya cerrado. */}
      {!abierto && quitar.fase === "reposo" && quitar.error ? (
        <small className="pulso-xf-home-card-campanas-error" role="alert">{quitar.error}</small>
      ) : null}
    </div>
  );
}
