// Lectura de la vista previa de una campaña complementaria (ADR 0101):
// cuántas preguntas calzan, cuáles quedan vacías, cuáles no entran y cuáles son
// ambiguas, o el bloqueo si no es una campaña de este instrumento.

import { AlertTriangle, Check } from "../../../vendor/lucide-react";
import type { CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import { leerVistaPrevia } from "./campanaComplementariaModel";
import "../styles/xf-campana.css";

export function CampanaVistaPreviaResumen({ vista }: { vista: CampanaVistaPrevia }) {
  const lectura = leerVistaPrevia(vista);
  return (
    <div className="pulso-xf-campana-vista">
      <p className="pulso-xf-campana-titular">
        {lectura.puedeDeclarar ? <Check size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
        <strong>{lectura.titular}</strong>
      </p>
      <p className="pulso-xf-campana-encuesta-elegida">
        {vista.titulo || "Encuesta sin título"} · ID {vista.survey_id}
      </p>
      {lectura.bloqueo ? (
        <p className="pulso-xf-campana-bloqueo" role="alert">{lectura.bloqueo}</p>
      ) : null}
      {lectura.grupos.length === 0 && lectura.puedeDeclarar ? (
        <p className="pulso-xf-campana-nota">Todas las preguntas del instrumento calzan con esta encuesta.</p>
      ) : null}
      {lectura.grupos.map((grupo) => (
        <div key={grupo.id} className={`pulso-xf-campana-grupo is-${grupo.id}`}>
          <h4>{grupo.titulo} ({grupo.preguntas.length})</h4>
          <ul>
            {grupo.preguntas.map((pregunta, index) => (
              <li key={`${pregunta.variable}-${index}`}>
                {pregunta.etiqueta || pregunta.variable}
                {pregunta.etiqueta && pregunta.variable ? (
                  <span className="pulso-xf-campana-variable"> · {pregunta.variable}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
