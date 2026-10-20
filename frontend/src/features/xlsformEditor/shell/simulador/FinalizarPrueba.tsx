// Lo que falta para finalizar y el cierre de la prueba (E8, 2026-10-20). La lista aparece al intentar finalizar con
// pendientes; cada una lleva a su pregunta.

import { AlertTriangle, ArrowRight, CheckCircle2 } from "../../../../vendor/lucide-react";
import { textoPreguntaPlano, type LectorReferencias } from "../../helpers/markdownPregunta";
import type { Pendiente } from "./modeloFinalizar";

export function FaltantesPrueba({ pendientes, lector, onIr }: {
  pendientes: readonly Pendiente[];
  lector: LectorReferencias;
  onIr: (p: Pendiente) => void;
}) {
  const faltan = pendientes.filter((p) => p.motivo === "falta").length;
  const reglas = pendientes.length - faltan;
  const partes = [
    faltan ? `${faltan} ${faltan === 1 ? "obligatoria sin responder" : "obligatorias sin responder"}` : "",
    reglas ? `${reglas} ${reglas === 1 ? "respuesta que no cumple su regla" : "respuestas que no cumplen su regla"}` : "",
  ].filter(Boolean);
  return (
    <section className="xfsp-faltan" role="alert" aria-labelledby="xfsp-faltan-titulo">
      <header>
        <AlertTriangle size={15} aria-hidden="true" />
        <strong id="xfsp-faltan-titulo">No se puede finalizar: {partes.join(" y ")}</strong>
      </header>
      <ul>
        {pendientes.map((p) => (
          <li key={p.rowIndex}>
            <button type="button" onClick={() => onIr(p)}>
              {p.numero ? <b>{p.numero}</b> : null}
              <span>{textoPreguntaPlano(p.enunciado, lector)}</span>
              <em>{p.motivo === "falta" ? "Falta" : "Revisar"}</em>
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PruebaFinalizada({ respondidas, onVolver, onReiniciar }: { respondidas: number; onVolver: () => void; onReiniciar: () => void }) {
  return (
    <div className="xfsp-fin" role="status">
      <CheckCircle2 size={28} aria-hidden="true" />
      <strong>Encuesta finalizada</strong>
      <span>{respondidas === 1 ? "1 respuesta" : `${respondidas} respuestas`}</span>
      <div>
        <button type="button" className="pulso-xfsim-pill" onClick={onVolver}>Volver a la última sección</button>
        <button type="button" className="pulso-xfsim-pill is-primary" onClick={onReiniciar}>Probar de nuevo</button>
      </div>
    </div>
  );
}
