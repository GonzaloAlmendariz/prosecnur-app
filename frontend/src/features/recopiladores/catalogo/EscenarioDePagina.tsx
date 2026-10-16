import type { ReactNode } from "react";

import { materialPreviewSrc, type MaterialCatalogOrientation } from "../../../api/materialCatalog";
import type { VistaDePagina } from "./estadoCatalogo";

type Props = {
  /** Página que va al frente. */
  frente: VistaDePagina | undefined;
  /** Segunda página, detrás y rotada, si el tipo tiene dorso. */
  dorso?: VistaDePagina | undefined;
  orientation: MaterialCatalogOrientation;
  /** Texto alternativo de la página del frente. */
  alt: string;
  tamano?: "tarjeta" | "pagina";
  /** Marca de estado en la esquina del escenario («En uso»). */
  etiqueta?: ReactNode;
};

function Hoja({ vista, alt, detras }: { vista: VistaDePagina | undefined; alt: string; detras?: boolean }) {
  const cls = `rec-cat-hoja${detras ? " rec-cat-hoja--detras" : ""}`;
  if (vista?.estado === "lista") {
    return (
      <img
        className={cls}
        src={materialPreviewSrc(vista.vista)}
        alt={detras ? "" : alt}
        aria-hidden={detras ? true : undefined}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`${cls} rec-cat-hoja--vacia${vista?.estado === "error" ? " is-error" : ""}`}
      aria-hidden={detras ? true : undefined}
      role={detras ? undefined : "img"}
      aria-label={detras ? undefined : vista?.estado === "error" ? `${alt}: sin vista previa` : `${alt}: cargando`}
    >
      {!detras && vista?.estado === "error" ? "Sin vista previa" : null}
    </span>
  );
}

/**
 * La página real del compilador sobre un escenario gris, con su sombra. Si el
 * tipo tiene dorso, la segunda página asoma detrás, rotada. La orientación
 * cambia la proporción de la hoja, no el escenario: todas las tarjetas miden lo
 * mismo (C2).
 */
export function EscenarioDePagina({ frente, dorso, orientation, alt, tamano = "tarjeta", etiqueta }: Props) {
  return (
    <span
      className={`rec-cat-escenario rec-cat-escenario--${tamano} is-${orientation}${dorso ? " con-dorso" : ""}`}
    >
      {dorso ? <Hoja vista={dorso} alt={alt} detras /> : null}
      <Hoja vista={frente} alt={alt} />
      {etiqueta}
    </span>
  );
}
