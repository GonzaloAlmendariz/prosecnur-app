// Cabeceras de un experimento de elección por pares en la Estructura (checklist elección por pares C5 y C7,
// 2026-11-07). Sólo existen en la Estructura, no en el XLSForm:
//   - «Experimento de elección por pares»: junta la introducción y los pares; va abierta de entrada;
//   - «Sorteo del par N»: los cálculos que sortean los dos perfiles de un par; va plegada de entrada.
// Clic pliega o despliega; «Diseño» abre el panel del experimento con el diseño leído del formulario.

import { useId, type ReactNode } from "react";
import { FlaskConical, Shuffle } from "../../../vendor/lucide-react";

export function FilaAgrupada({
  id,
  variante,
  titulo,
  conteo,
  conteoLargo,
  abierta,
  enRecorrido,
  onPlegar,
  onAbrirDiseno,
  children,
}: {
  id: number;
  variante: "experimento" | "sorteo";
  titulo: string;
  /** Lo que va en la pastilla de la derecha («30», «8 pares»). */
  conteo: string;
  /** El mismo conteo dicho entero, para el lector de pantalla y el title. */
  conteoLargo: string;
  abierta: boolean;
  enRecorrido: boolean;
  onPlegar: (id: number) => void;
  onAbrirDiseno?: () => void;
  children: ReactNode;
}) {
  const idHijos = useId();
  const Icono = variante === "experimento" ? FlaskConical : Shuffle;
  return (
    <div className={`xfe-seccion is-${variante}${abierta ? "" : " is-plegada"}`} data-agrupada={variante} data-linea-agrupada={id}>
      <div className="xfe-ranura" data-linea={id}>
        <div className="pulso-outline-row xfe-sec-cab xfe-agrupada-cab">
          <div
            role="button"
            tabIndex={enRecorrido ? 0 : -1}
            aria-expanded={abierta}
            aria-controls={idHijos}
            aria-keyshortcuts="Enter ArrowLeft ArrowRight"
            title={`${titulo}: ${conteoLargo}.\nClic: ${abierta ? "plegar" : "desplegar"}.`}
            data-nav={id}
            onClick={() => onPlegar(id)}
            className="pulso-outline-body xfe-sec-cab__cuerpo"
          >
            <span className="pulso-outline-typeicon xfe-sello" aria-hidden="true">
              <Icono size={14} />
            </span>
            <strong className="pulso-outline-title xfe-sec-cab__titulo">{titulo}</strong>
            <small className="xfe-sec-cab__conteo" aria-label={conteoLargo}>
              {conteo}
            </small>
          </div>
          {onAbrirDiseno ? (
            <button type="button" className="xfe-agrupada-cab__diseno" onClick={onAbrirDiseno} tabIndex={enRecorrido ? 0 : -1}>
              Diseño
            </button>
          ) : null}
        </div>
      </div>
      <div className="xfe-seccion__hijos" id={idHijos} role="group" aria-label={`Contenido de «${titulo}»`} hidden={!abierta}>
        {children}
      </div>
    </div>
  );
}
