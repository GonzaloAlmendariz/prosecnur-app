// Códigos especiales del libro de códigos: lo que se ofrece marcar.
//
// Antes era una lista fija (95 «No contesta» … 99 «Otros») que no correspondía
// a cada estudio. Ahora son SUGERENCIAS leídas de los instrumentos (códigos
// 77–99 o negativos con su etiqueta real) más lo ya configurado; nada se marca
// solo y se puede agregar un código propio (Gonzalo, 2026-10-16).

import type { CodigoEspecialSugerido, UsoCodigoEnBase } from "../../../api/analitica";
import { formatoConteoDe } from "../../../lib/formatoNumero";

export type OpcionCodigoEspecial = {
  code: number;
  label: string;
  /** `estudio`: aparece en los instrumentos; `configurado`: marcado pero no está en ellos. */
  origen: "estudio" | "configurado";
  marcado: boolean;
  /** El código tiene etiquetas distintas según la pregunta («Ninguna» / «No sabe»). */
  ambiguo: boolean;
  /** Las demás etiquetas del código en el estudio (la principal va en `label`). */
  otras: string[];
  /** Uso por base; vacío si no se pudo contar. */
  porBase: UsoCodigoEnBase[];
};

/** «En 14 preguntas · elegido en 5»; sin uso, cadena vacía. */
export function textoUso(o: Pick<OpcionCodigoEspecial, "porBase">): string {
  if (!o.porBase.length) return "";
  const preguntas = o.porBase.reduce((s, u) => s + u.n_preguntas, 0);
  if (!preguntas) return "";
  const conCasos = o.porBase.every((u) => u.n_con_casos !== null)
    ? o.porBase.reduce((s, u) => s + (u.n_con_casos ?? 0), 0)
    : null;
  const base = `En ${formatoConteoDe(preguntas, "pregunta", "preguntas")}`;
  return conCasos === null ? base : `${base} · elegido en ${conCasos}`;
}

/** Qué hace marcarlo: «Se omitirá en 9 preguntas donde nadie lo eligió». */
export function textoEfecto(o: Pick<OpcionCodigoEspecial, "porBase" | "marcado">): string {
  if (!o.marcado || !o.porBase.length || o.porBase.some((u) => u.n_con_casos === null)) return "";
  const sinCasos = o.porBase.reduce((s, u) => s + (u.n_preguntas - (u.n_con_casos ?? 0)), 0);
  return sinCasos > 0
    ? `Se omitirá en ${formatoConteoDe(sinCasos, "pregunta", "preguntas")} donde nadie lo eligió`
    : "Se muestra en todas: en cada pregunta alguien lo eligió";
}

/** Desglose por base para el `title`: «2024: 4 preguntas, elegido en 3 · 2026: …». */
export function textoPorBase(o: Pick<OpcionCodigoEspecial, "porBase">): string {
  return o.porBase
    .filter((u) => u.n_preguntas > 0)
    .map((u) => `${u.base}: ${formatoConteoDe(u.n_preguntas, "pregunta", "preguntas")}${u.n_con_casos === null ? "" : `, elegido en ${u.n_con_casos}`}`)
    .join(" · ");
}

/** El default de fábrica de versiones anteriores: nadie lo eligió. */
const DEFAULT_HEREDADO = [96, 97, 98, 99];

/**
 * Los códigos marcados, sin el default heredado. Hasta 2026-10 todo proyecto
 * nacía con 96–99 marcados aunque no correspondieran al estudio; esa lista
 * exacta se trata como «sin elegir» (Gonzalo: «se están asumiendo estos códigos
 * y podría hacer overlap con códigos diferentes de proyectos diferentes»).
 */
export function sinDefaultHeredado(codes: readonly number[]): number[] {
  const ordenados = [...codes].sort((a, b) => a - b);
  return ordenados.length === DEFAULT_HEREDADO.length && ordenados.every((c, i) => c === DEFAULT_HEREDADO[i])
    ? []
    : [...codes];
}

export function opcionesCodigosEspeciales(
  sugeridos: readonly CodigoEspecialSugerido[],
  marcados: readonly number[],
): OpcionCodigoEspecial[] {
  const out = new Map<number, OpcionCodigoEspecial>();
  for (const s of sugeridos) {
    const code = Number(s.codigo);
    if (!Number.isInteger(code)) continue;
    const etiquetas = (s.etiquetas.length ? s.etiquetas : [s.etiqueta]).filter(Boolean);
    out.set(code, {
      code,
      label: etiquetas[0] ?? "Sin etiqueta",
      origen: "estudio",
      marcado: marcados.includes(code),
      ambiguo: etiquetas.length > 1,
      otras: etiquetas.slice(1),
      porBase: s.por_base ?? [],
    });
  }
  for (const code of marcados) {
    if (!out.has(code)) out.set(code, { code, label: "No se usa en este estudio", origen: "configurado", marcado: true, ambiguo: false, otras: [], porBase: [] });
  }
  return [...out.values()].sort((a, b) => a.code - b.code);
}

/** Un código escrito a mano: entero, o `null` si no lo es. */
export function codigoEscrito(texto: string): number | null {
  const t = texto.trim();
  return /^-?\d+$/.test(t) ? Number(t) : null;
}
