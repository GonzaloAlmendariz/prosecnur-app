import { Calculator, Loader2 } from "lucide-react";

import "./mesa.css";

/**
 * El botón que calcula, en la pestaña donde se fijan los datos que consume
 * (E15 · P4: Método › Parámetros en Muestra general, Actores en
 * Acreditación). La cabecera sólo enlaza aquí. Nunca reenvía el evento del
 * clic: la página lo leería como el estudio a calcular.
 */
export function AccionCalcular({
  calculado,
  calculando,
  onCalcular,
  nota,
  motivo = null,
}: {
  calculado: boolean;
  calculando: boolean;
  onCalcular: () => void;
  /** Qué se calcula con qué, en una línea. */
  nota: string;
  /** Por qué todavía no se puede calcular; deshabilita el botón y se lee a su lado. */
  motivo?: string | null;
}) {
  return (
    <div className="cmv2-inline-actions cmg-accion-calcular" data-qa-geometry-member>
      <button
        type="button"
        className="cmv2-primary"
        onClick={() => onCalcular()}
        disabled={calculando || Boolean(motivo)}
        aria-busy={calculando || undefined}
        aria-describedby="cmg-accion-calcular-nota"
      >
        {calculando
          ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
          : <Calculator size={14} aria-hidden="true" />}
        {calculando ? "Calculando…" : calculado ? "Recalcular" : "Calcular"}
      </button>
      <span id="cmg-accion-calcular-nota" className={motivo ? "cmg-motivo" : "cmg-nota"}>{motivo ?? nota}</span>
    </div>
  );
}
