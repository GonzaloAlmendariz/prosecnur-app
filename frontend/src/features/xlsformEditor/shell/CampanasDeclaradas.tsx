// Campañas complementarias declaradas en la tarjeta de un formulario (ADR 0101).
//
// Sólo se pinta si hay alguna (C3: sin campañas no queda una caja vacía).
// «Quitar» pide confirmación aunque declarar de nuevo la recupere.

import { useState } from "react";
import { X } from "../../../vendor/lucide-react";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { apiCampanaQuitar, type CampanaDeclarada } from "../../../api/xlsformCampanas";
import { resumenCampanas } from "./campanaComplementariaModel";
import "../styles/xf-campana.css";

type EstadoQuitar =
  | { fase: "reposo"; error: string }
  | { fase: "confirmar"; surveyId: string }
  | { fase: "quitando"; surveyId: string };

export type CampanasDeclaradasProps = {
  formId: string;
  formName: string;
  campanas: readonly CampanaDeclarada[];
  onCambio?: (formId: string) => void;
};

function detalleCampana(campana: CampanaDeclarada): string {
  const partes = [`ID ${campana.survey_id}`];
  if (campana.n_emparejadas != null && campana.n_preguntas_base != null) {
    partes.push(`calzan ${campana.n_emparejadas} de ${campana.n_preguntas_base}`);
  }
  return partes.join(" · ");
}

export function CampanasDeclaradas({ formId, formName, campanas, onCambio }: CampanasDeclaradasProps) {
  const [quitar, setQuitar] = useState<EstadoQuitar>({ fase: "reposo", error: "" });
  if (campanas.length === 0) return null;

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
    <section className="pulso-xf-home-card-campanas" aria-label={`Campañas de ${formName}`}>
      <span className="pulso-xf-home-card-campanas-resumen">{resumenCampanas(campanas.length)}</span>
      <ul>
        {campanas.map((campana) => {
          const enConfirmacion = quitar.fase === "confirmar" && quitar.surveyId === campana.survey_id;
          const quitando = quitar.fase === "quitando" && quitar.surveyId === campana.survey_id;
          const titulo = campana.survey_title || "Encuesta sin título";
          return (
            <li key={campana.survey_id}>
              <span className="pulso-xf-home-card-campana-texto">
                <strong title={titulo}>{titulo}</strong>
                <small>{detalleCampana(campana)}</small>
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
                  {quitando ? "Quitando…" : <><X size={12} aria-hidden="true" /> Quitar</>}
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
  );
}
