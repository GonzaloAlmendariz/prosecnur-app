// Un contenedor de la mesa de una pestaña de Procesamiento (ADR 0142, plan de
// fidelidad de Validación, V0; `panel` del prototipo). Promovido desde
// `features/analitica/tablas/PanelDeZona.tsx`.
//
// El `Panel` del kit con la cabecera de 56 px (tesela con el ícono, título,
// conteo en píldora y acciones a la derecha), un cuerpo que es el único dueño
// del scroll y del alto libre (C3 y C4) y, si lo hay, un pie fijo en un tono más
// bajo con la acción principal a todo el ancho.

import type { ReactNode } from "react";

import { Panel } from "../Panel";
import { formatoConteo } from "../../lib/formatoNumero";
import "./mesa-procesamiento.css";

export function PanelDeMesa({
  zona,
  titulo,
  icono,
  conteo,
  acciones,
  pie,
  ocupado = false,
  grupo,
  etiquetaCuerpo,
  children,
}: {
  /** El papel del contenedor en la mesa ("cola", "decision", "familias"); nombra la clase y el orden de entrada. */
  zona: string;
  /** El título: un nombre ("Cola", "Familias") o, en un detalle, el de lo elegido. */
  titulo: ReactNode;
  /** El ícono del contenedor, ya dibujado; sin ícono no hay tesela (la ficha de una regla no lleva). */
  icono?: ReactNode;
  /** Cuántos elementos lista, junto al título. */
  conteo?: number | string;
  /** Controles de la cabecera. */
  acciones?: ReactNode;
  /** Línea fija bajo el cuerpo. */
  pie?: ReactNode;
  /** Lo que se ve es de una lectura anterior y se está releyendo. */
  ocupado?: boolean;
  /** Grupo de geometría de las secciones del cuerpo, cuando las tiene. */
  grupo?: string;
  /** Nombre del cuerpo para el lector de pantalla; por defecto, el título si es texto. */
  etiquetaCuerpo?: string;
  children: ReactNode;
}) {
  const nombre = etiquetaCuerpo ?? (typeof titulo === "string" ? titulo : undefined);
  return (
    <Panel
      noPadding
      data-entra="sube"
      className={`pulso-panel-de-mesa pulso-panel-de-mesa--${zona}`}
      title={(
        <>
          {icono ? <span className="pulso-panel-de-mesa-tesela" aria-hidden="true">{icono}</span> : null}
          <span className="pulso-panel-de-mesa-titulo">{titulo}</span>
          {conteo !== undefined ? (
            <span className="pulso-panel-de-mesa-conteo">{typeof conteo === "number" ? formatoConteo(conteo) : conteo}</span>
          ) : null}
        </>
      )}
      actions={acciones}
    >
      {/* El cuerpo se desplaza con el teclado: es una región con nombre y parada de tabulador. */}
      <div
        className="pulso-panel-de-mesa-cuerpo"
        role="region"
        aria-label={nombre}
        aria-busy={ocupado || undefined}
        tabIndex={0}
        data-qa-geometry-capacity="owned"
        {...(grupo ? { "data-qa-geometry-group": grupo, "data-qa-geometry-contract": "intrinsic" } : {})}
      >
        {children}
      </div>
      {pie ? <div className="pulso-panel-de-mesa-pie">{pie}</div> : null}
    </Panel>
  );
}
