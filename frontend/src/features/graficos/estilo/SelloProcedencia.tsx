// Sello de procedencia de un bloque del estilo (ADR 0094 §4): «Del recetario» si no difiere del default, «Propio» si es
// una decisión de este cliente. Texto siempre visible: el color sólo acompaña.

import type { Procedencia } from "./modeloEstilo";

export function SelloProcedencia({ procedencia }: { procedencia: Procedencia }) {
  return (
    <span className={`pulso-f6-estilo-sello is-${procedencia}`}>
      {procedencia === "propio" ? "Propio" : "Por defecto"}
    </span>
  );
}

/** «Modificado» de una sección (decisión 5a): sólo aparece si algo difiere del default. */
export function MarcaModificado({ visible }: { visible: boolean }) {
  return visible ? <span className="pulso-f6-estilo-modificado">Modificado</span> : null;
}
