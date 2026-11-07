// Sorteo de un par en la Estructura (checklist elección por pares C5, 2026-11-07): los cálculos que sortean los dos
// perfiles de un par se ven como una sola línea, plegada de entrada. Clic pliega o despliega; «Diseño» abre el panel
// del experimento con el diseño leído del formulario.

import { useId, type ReactNode } from "react";
import { Shuffle } from "../../../vendor/lucide-react";
import { formatoConteo } from "../../../lib/formatoNumero";

export function FilaSorteo({
  id,
  tarea,
  calculos,
  abierta,
  enRecorrido,
  onPlegar,
  onAbrirDiseno,
  children,
}: {
  id: number;
  tarea: number;
  calculos: number;
  abierta: boolean;
  enRecorrido: boolean;
  onPlegar: (id: number) => void;
  onAbrirDiseno?: () => void;
  children: ReactNode;
}) {
  const idHijos = useId();
  const titulo = `Sorteo del par ${tarea}`;
  return (
    <div className={`xfe-seccion is-sorteo${abierta ? "" : " is-plegada"}`} data-sorteo={tarea}>
      <div className="xfe-ranura" data-linea={id}>
        <div className="pulso-outline-row xfe-sec-cab xfe-sorteo-cab">
          <div
            role="button"
            tabIndex={enRecorrido ? 0 : -1}
            aria-expanded={abierta}
            aria-controls={idHijos}
            aria-keyshortcuts="Enter ArrowLeft ArrowRight"
            title={`${titulo}: ${formatoConteo(calculos)} cálculos que sortean los dos perfiles.\nClic: ${abierta ? "plegar" : "desplegar"}.`}
            data-nav={id}
            onClick={() => onPlegar(id)}
            className="pulso-outline-body xfe-sec-cab__cuerpo"
          >
            <span className="pulso-outline-typeicon xfe-sello" aria-hidden="true">
              <Shuffle size={14} />
            </span>
            <strong className="pulso-outline-title xfe-sec-cab__titulo">{titulo}</strong>
            <small className="xfe-sec-cab__conteo" aria-label={`${formatoConteo(calculos)} cálculos`}>
              {formatoConteo(calculos)}
            </small>
          </div>
          {onAbrirDiseno ? (
            <button type="button" className="xfe-sorteo-cab__diseno" onClick={onAbrirDiseno} tabIndex={enRecorrido ? 0 : -1}>
              Diseño
            </button>
          ) : null}
        </div>
      </div>
      <div className="xfe-seccion__hijos" id={idHijos} role="group" aria-label={`Cálculos de «${titulo}»`} hidden={!abierta}>
        {children}
      </div>
    </div>
  );
}
