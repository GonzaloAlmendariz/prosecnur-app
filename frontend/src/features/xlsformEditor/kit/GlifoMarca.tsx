import type { CSSProperties } from "react";
import { FormasGlifo } from "./Glifo";
import { GLIFOS_MARCA, type ClaveMarca } from "./glifosMarca";
import { INFO_MARCA } from "./marcasNodo";
import "./sello.css";

// Glifo de una marca (obligatoria, condición, restricción…) en el tono de la marca. Decorativo: el nombre lo lleva
// el control que lo contiene.

export function GlifoMarca({ clave, size = 16 }: { clave: ClaveMarca; size?: number }) {
  return (
    <svg
      className="xfk-marca xfk-glifo"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ "--xfk-c": INFO_MARCA[clave].tono } as CSSProperties}
      data-marca={clave}
      aria-hidden="true"
      focusable="false"
    >
      <FormasGlifo formas={GLIFOS_MARCA[clave]} />
    </svg>
  );
}
