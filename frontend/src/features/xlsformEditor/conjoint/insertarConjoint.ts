// Inserta y reemplaza experimentos en el formulario: elección por pares (E7b editor-conjoint, 2026-11-06) y viñetas
// (checklist elección por pares C10, 2026-11-07).
// Las filas de `generarConjoint` entran juntas en el lugar del «+» y su lista de elección se agrega a choices. Si un
// nombre ya existe en el formulario no se inserta nada: un conjoint a medias es peor que ninguno.

import { indiceInsercion, type DestinoInsercion } from "../state/accionesConstructor";
import { deleteRow, insertRecord, rowToRecord } from "../parsing/sheetUtils";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";
import type { LecturaConjoint } from "./leerConjoint";
import { generarConjoint, validarDiseno, type DisenoConjoint } from "./modeloConjoint";
import { generarVinetas, validarVinetas, type DisenoVinetas } from "./modeloVinetas";
import type { LecturaVinetas } from "./leerVinetas";
import type { LecturaVersiones } from "./leerVersiones";
import { generarVersiones, validarVersiones, type DisenoVersiones } from "./modeloVersiones";
import type { LecturaLista } from "./leerLista";
import { generarLista, validarLista, type DisenoLista } from "./modeloLista";
import type { LecturaRespaldo } from "./leerRespaldo";
import { generarRespaldo, validarRespaldo, type DisenoRespaldo } from "./modeloRespaldo";

export type ResultadoConjoint =
  | { ok: true; rowIndex: number; filas: number; calculos: number }
  | { ok: false; motivos: string[] };

function columnaDe(draft: XlsformEditorWorkbook, hoja: "survey" | "choices", columna: string): Set<string> {
  const sheet = draft[hoja];
  const out = new Set<string>();
  sheet.rows.forEach((_, i) => {
    const v = (rowToRecord(sheet, i)[columna] ?? "").trim();
    if (v) out.add(v);
  });
  return out;
}

/** Primer prefijo libre a partir de `base` (`cj`, `cj2`, `cj3`…): ningún nombre ni lista del formulario empieza así. */
export function prefijoLibre(draft: XlsformEditorWorkbook, base = "cj"): string {
  const nombres = [...columnaDe(draft, "survey", "name"), ...columnaDe(draft, "choices", "list_name")];
  for (let i = 1; ; i += 1) {
    const p = i === 1 ? base : `${base}${i}`;
    if (!nombres.some((n) => n === p || n.startsWith(`${p}_`))) return p;
  }
}

export function insertarConjoint(
  draft: XlsformEditorWorkbook,
  structure: BuilderStructure,
  destino: DestinoInsercion,
  diseno: DisenoConjoint,
): ResultadoConjoint {
  const problemas = validarDiseno(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarConjoint(diseno);
  return insertarBloque(draft, structure, destino, survey, choices, diseno.prefijo);
}

/** Lo que un reemplazo necesita saber del experimento ya escrito, sea de pares o de viñetas. */
export type BloqueEscrito = { filas: readonly number[]; ancla: number; lista: string; fiel: boolean; motivo: string | null };

/**
 * Reemplaza un experimento ya escrito por las filas de su diseño editado (checklist elección por pares C5 y C10). Las
 * filas nuevas traen los nombres que el experimento tenía, así que las variables que ya se analizan no cambian. Entra
 * donde estaba su primer par o viñeta (o su introducción); su lista se reescribe en el mismo lugar. No hace nada si una
 * variable que desaparece se usa fuera del experimento, o si un nombre nuevo choca con otra fila.
 */
export function reemplazarBloque(
  draft: XlsformEditorWorkbook,
  bloque: BloqueEscrito,
  survey: readonly Record<string, string>[],
  choices: readonly Record<string, string>[],
): ResultadoConjoint {
  if (!bloque.fiel) return { ok: false, motivos: [bloque.motivo ?? "El experimento no se puede editar desde aquí."] };
  const quitar = new Set(bloque.filas);
  const nombre = (i: number) => (rowToRecord(draft.survey, i).name ?? "").trim();
  const viejos = new Set(bloque.filas.map(nombre).filter(Boolean));
  const nuevos = new Set(survey.map((f) => f.name ?? "").filter(Boolean));

  const motivos: string[] = [];
  const choque = [...nuevos].find((n) => !viejos.has(n) && draft.survey.rows.some((_, i) => !quitar.has(i) && nombre(i) === n));
  if (choque) motivos.push(`«${choque}» ya existe fuera del experimento.`);
  const perdidos = [...viejos].filter((n) => !nuevos.has(n));
  for (const n of perdidos) {
    const usa = draft.survey.rows.findIndex((row, i) => !quitar.has(i) && row.some((c) => (c ?? "").includes("${" + n + "}")));
    if (usa >= 0) {
      motivos.push(`«${nombre(usa) || `fila ${usa + 2}`}» usa «${n}», que deja de existir con este cambio.`);
      break;
    }
  }
  if (motivos.length) return { ok: false, motivos };

  // Entra donde empezaba el experimento: el sorteo que estuviera suelto más arriba se recoge adentro.
  const indice = bloque.ancla - bloque.filas.filter((i) => i < bloque.ancla).length;
  // Lo que el experimento no escribe (parameters con el orden al azar, hint, traducciones…) se conserva: cada fila
  // nueva hereda de la vieja con su mismo nombre las columnas que el generador no trae.
  const previas = new Map<string, Record<string, string>>();
  for (const i of quitar) {
    const n = nombre(i);
    if (n) previas.set(n, { ...rowToRecord(draft.survey, i) });
  }
  [...quitar].sort((a, b) => b - a).forEach((i) => deleteRow(draft.survey, i));
  survey.forEach((f, k) => {
    const vieja = previas.get(f.name ?? "");
    const heredadas = vieja ? Object.fromEntries(Object.entries(vieja).filter(([c, v]) => v && !(c in f))) : {};
    insertRecord(draft.survey, indice + k, { ...heredadas, ...f });
  });

  // Sin lista propia (versiones al azar usa una lista del formulario), choices no se toca.
  if (!bloque.lista) return { ok: true, rowIndex: indice, filas: survey.length, calculos: survey.filter((f) => f.type === "calculate").length };
  const deLista = draft.choices.rows.map((_, i) => i).filter((i) => (rowToRecord(draft.choices, i).list_name ?? "").trim() === bloque.lista);
  const enChoices = deLista.length ? deLista[0]! : draft.choices.rows.length;
  deLista.sort((a, b) => b - a).forEach((i) => deleteRow(draft.choices, i));
  choices.forEach((c, k) => insertRecord(draft.choices, enChoices + k, { ...c }));
  return { ok: true, rowIndex: indice, filas: survey.length, calculos: survey.filter((f) => f.type === "calculate").length };
}

/** El experimento de elección por pares ya escrito, con el diseño editado. */
export function reemplazarConjoint(
  draft: XlsformEditorWorkbook,
  lectura: LecturaConjoint,
  diseno: DisenoConjoint,
): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarDiseno(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarConjoint(diseno, lectura.nombres);
  const ancla = lectura.intro ?? lectura.pares[0]!.grupo;
  return reemplazarBloque(draft, { filas: lectura.filas, ancla, lista: lectura.nombres.lista, fiel: lectura.fiel, motivo: lectura.motivo }, survey, choices);
}

/** Inserta filas nuevas de un experimento en el lugar del «+» y agrega su lista. Nada si un nombre ya existe. */
export function insertarBloque(
  draft: XlsformEditorWorkbook,
  structure: BuilderStructure,
  destino: DestinoInsercion,
  survey: readonly Record<string, string>[],
  choices: readonly Record<string, string>[],
  prefijo: string,
): ResultadoConjoint {
  const usados = columnaDe(draft, "survey", "name");
  const choque = survey.map((f) => f.name ?? "").filter((n) => n && usados.has(n));
  const listas = columnaDe(draft, "choices", "list_name");
  const lista = choices[0]?.list_name ?? "";
  if (choque.length || (lista && listas.has(lista))) {
    return {
      ok: false,
      motivos: [`El prefijo «${prefijo}» ya se usa en el formulario (${choque[0] ?? lista}). Elige otro, por ejemplo «${prefijoLibre(draft, prefijo)}».`],
    };
  }
  const indice = indiceInsercion(structure, destino, draft.survey.rows.length);
  survey.forEach((f, i) => insertRecord(draft.survey, indice + i, { ...f }));
  choices.forEach((c) => insertRecord(draft.choices, draft.choices.rows.length, { ...c }));
  return { ok: true, rowIndex: indice, filas: survey.length, calculos: survey.filter((f) => f.type === "calculate").length };
}

/** Un experimento de viñetas nuevo, en el lugar del «+». */
export function insertarVinetas(draft: XlsformEditorWorkbook, structure: BuilderStructure, destino: DestinoInsercion, diseno: DisenoVinetas): ResultadoConjoint {
  const problemas = validarVinetas(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarVinetas(diseno);
  return insertarBloque(draft, structure, destino, survey, choices, diseno.prefijo);
}

/** El experimento de viñetas ya escrito, con el diseño editado. */
export function reemplazarVinetas(draft: XlsformEditorWorkbook, lectura: LecturaVinetas, diseno: DisenoVinetas): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarVinetas(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarVinetas(diseno, lectura.nombres);
  const ancla = lectura.intro ?? lectura.vinetas[0]!.grupo;
  return reemplazarBloque(draft, { filas: lectura.filas, ancla, lista: lectura.nombres.lista, fiel: lectura.fiel, motivo: lectura.motivo }, survey, choices);
}

/** Listas de opciones del formulario (para validar la de una pregunta con versiones). */
export const listasDe = (draft: XlsformEditorWorkbook) => [...columnaDe(draft, "choices", "list_name")];

/** Una pregunta con versiones al azar nueva, en el lugar del «+». */
export function insertarVersiones(draft: XlsformEditorWorkbook, structure: BuilderStructure, destino: DestinoInsercion, diseno: DisenoVersiones): ResultadoConjoint {
  const problemas = validarVersiones(diseno, listasDe(draft));
  if (problemas.length) return { ok: false, motivos: problemas };
  return insertarBloque(draft, structure, destino, generarVersiones(diseno), [], diseno.prefijo);
}

/** La pregunta con versiones al azar ya escrita, con el diseño editado. */
export function reemplazarVersiones(draft: XlsformEditorWorkbook, lectura: LecturaVersiones, diseno: DisenoVersiones): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarVersiones(diseno, listasDe(draft));
  if (problemas.length) return { ok: false, motivos: problemas };
  return reemplazarBloque(draft, { filas: lectura.filas, ancla: lectura.filas[0]!, lista: "", fiel: true, motivo: null }, generarVersiones(diseno), []);
}

/** Un experimento de lista nuevo, en el lugar del «+» (C14). */
export function insertarLista(draft: XlsformEditorWorkbook, structure: BuilderStructure, destino: DestinoInsercion, diseno: DisenoLista): ResultadoConjoint {
  const problemas = validarLista(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  return insertarBloque(draft, structure, destino, generarLista(diseno), [], diseno.prefijo);
}

/** El experimento de lista ya escrito, con el diseño editado. */
export function reemplazarLista(draft: XlsformEditorWorkbook, lectura: LecturaLista, diseno: DisenoLista): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarLista(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  return reemplazarBloque(draft, { filas: lectura.filas, ancla: lectura.filas[0]!, lista: "", fiel: true, motivo: null }, generarLista(diseno), []);
}

/** Un experimento de respaldo nuevo, en el lugar del «+» (C15). */
export function insertarRespaldo(draft: XlsformEditorWorkbook, structure: BuilderStructure, destino: DestinoInsercion, diseno: DisenoRespaldo): ResultadoConjoint {
  const problemas = validarRespaldo(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarRespaldo(diseno);
  return insertarBloque(draft, structure, destino, survey, choices, diseno.prefijo);
}

/** El experimento de respaldo ya escrito, con el diseño editado. */
export function reemplazarRespaldo(draft: XlsformEditorWorkbook, lectura: LecturaRespaldo, diseno: DisenoRespaldo): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarRespaldo(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarRespaldo(diseno);
  return reemplazarBloque(draft, { filas: lectura.filas, ancla: lectura.filas[0]!, lista: `${diseno.prefijo}_apoyo`, fiel: true, motivo: null }, survey, choices);
}
