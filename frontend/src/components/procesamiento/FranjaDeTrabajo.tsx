// Franja de un trabajo en curso de Procesamiento (ADR 0142, plan de fidelidad
// de Validación, V0; `prog` del prototipo): el giro, el título, el detalle, la
// barra con el porcentaje, una nota y "Cancelar". El trabajo largo avanza en su
// lugar y deja leer lo demás.
//
// Se crea porque `JobProgress` no alcanza: pinta una etiqueta y el mensaje del
// motor, sin detalle propio, sin nota y sin el porcentaje a la vista. Esta
// pieza es solo presentación: quien la monta sigue el trabajo (`useJob`) y le
// pasa lo que sabe. Sin porcentaje medible, la barra es indeterminada.

import { BarraDeAvance } from "../BarraDeAvance";
import { PulsoButton } from "../PulsoButton";
import { X } from "../../vendor/lucide-react";
import "../states.css";
import "./mesa-procesamiento.css";

export function FranjaDeTrabajo({ titulo, detalle, porcentaje, nota, onCancelar, cancelando = false, textoCancelar = "Cancelar" }: {
  /** Lo que se está haciendo: "Auditando la base". */
  titulo: string;
  /** Dónde va o desde cuándo; vacío si el motor no lo publica. */
  detalle?: string | null;
  /** De 0 a 100; `null` o ausente si el motor no publica el avance. */
  porcentaje?: number | null;
  /** Lo que sigue a la vista mientras tanto. */
  nota?: string | null;
  /** Sin esta función no hay botón: un trabajo que no se puede cancelar no lo ofrece. */
  onCancelar?: () => void;
  cancelando?: boolean;
  textoCancelar?: string;
}) {
  const medible = typeof porcentaje === "number" && Number.isFinite(porcentaje);
  const pc = medible ? Math.max(0, Math.min(100, Math.round(porcentaje))) : null;
  return (
    <div className="pulso-franja-trabajo" role="status" aria-live="polite">
      <div className="pulso-franja-trabajo-fila">
        <span className="pulso-franja-trabajo-giro" aria-hidden="true">
          <span className="pulso-states-spinner" />
        </span>
        <div className="pulso-franja-trabajo-texto">
          <b>{titulo}</b>
          {detalle ? <span>{detalle}</span> : null}
        </div>
        <div className="pulso-franja-trabajo-avance">
          {pc !== null ? (
            <>
              <BarraDeAvance valor={pc} total={100} etiqueta={titulo} />
              <em>{pc} %</em>
            </>
          ) : (
            <BarraDeAvance etiqueta={titulo} indeterminada />
          )}
        </div>
        {nota ? <span className="pulso-franja-trabajo-nota">{nota}</span> : null}
        {onCancelar ? (
          <PulsoButton variant="secondary" size="sm" onClick={onCancelar} disabled={cancelando}>
            <X size={14} aria-hidden />
            {textoCancelar}
          </PulsoButton>
        ) : null}
      </div>
    </div>
  );
}
