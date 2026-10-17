// Tono por familia de tipo de pregunta. Desde M8 (2026-10-17) la familia y su tono salen del catálogo único
// (`tiposPregunta.ts`); este módulo queda como fachada para quien ya lo importaba.
// El color vive SÓLO en el ícono o la marca del tipo: la ficha, la fila y el texto quedan en tinta.

import { TONO_FAMILIA, tipoPregunta, type FamiliaTipo } from "./tiposPregunta";

export type TypeFamily = FamiliaTipo;

export function typeFamily(baseType: string): TypeFamily {
  return tipoPregunta(baseType).familia;
}

/** Valor CSS (siempre un `var(--…)`) del tono del ícono de un tipo. */
export function typeTone(baseType: string): string {
  return TONO_FAMILIA[typeFamily(baseType)];
}
