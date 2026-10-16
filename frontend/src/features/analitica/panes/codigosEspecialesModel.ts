// Códigos especiales del libro de códigos: lo que se ofrece marcar.
//
// Antes era una lista fija (95 «No contesta» … 99 «Otros») que no correspondía
// a cada estudio. Ahora son SUGERENCIAS leídas de los instrumentos (códigos
// 77–99 o negativos con su etiqueta real) más lo ya configurado; nada se marca
// solo y se puede agregar un código propio (Gonzalo, 2026-10-16).

import type { CodigoEspecialSugerido } from "../../../api/analitica";

export type OpcionCodigoEspecial = {
  code: number;
  label: string;
  /** `estudio`: aparece en los instrumentos; `configurado`: marcado pero no está en ellos. */
  origen: "estudio" | "configurado";
  marcado: boolean;
};

export function opcionesCodigosEspeciales(
  sugeridos: readonly CodigoEspecialSugerido[],
  marcados: readonly number[],
): OpcionCodigoEspecial[] {
  const out = new Map<number, OpcionCodigoEspecial>();
  for (const s of sugeridos) {
    const code = Number(s.codigo);
    if (!Number.isInteger(code)) continue;
    out.set(code, { code, label: s.etiqueta || "Sin etiqueta", origen: "estudio", marcado: marcados.includes(code) });
  }
  for (const code of marcados) {
    if (!out.has(code)) out.set(code, { code, label: "No aparece en los instrumentos", origen: "configurado", marcado: true });
  }
  return [...out.values()].sort((a, b) => a.code - b.code);
}

/** Un código escrito a mano: entero, o `null` si no lo es. */
export function codigoEscrito(texto: string): number | null {
  const t = texto.trim();
  return /^-?\d+$/.test(t) ? Number(t) : null;
}
