// Inserta un experimento conjoint generado en el formulario (E7b editor-conjoint, 2026-11-06).
// Las filas de `generarConjoint` entran juntas en el lugar del «+» y su lista de elección se agrega a choices. Si un
// nombre ya existe en el formulario no se inserta nada: un conjoint a medias es peor que ninguno.

import { indiceInsercion, type DestinoInsercion } from "../state/accionesConstructor";
import { deleteRow, insertRecord, rowToRecord } from "../parsing/sheetUtils";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";
import type { LecturaConjoint } from "./leerConjoint";
import { generarConjoint, validarDiseno, type DisenoConjoint } from "./modeloConjoint";

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
  const usados = columnaDe(draft, "survey", "name");
  const choque = survey.map((f) => f.name).filter((n) => n && usados.has(n));
  const listas = columnaDe(draft, "choices", "list_name");
  if (choque.length || listas.has(choices[0]!.list_name)) {
    return {
      ok: false,
      motivos: [`El prefijo «${diseno.prefijo}» ya se usa en el formulario (${choque[0] ?? choices[0]!.list_name}). Elige otro, por ejemplo «${prefijoLibre(draft, diseno.prefijo)}».`],
    };
  }
  const indice = indiceInsercion(structure, destino, draft.survey.rows.length);
  survey.forEach((f, i) => insertRecord(draft.survey, indice + i, { ...f }));
  choices.forEach((c) => insertRecord(draft.choices, draft.choices.rows.length, { ...c }));
  return { ok: true, rowIndex: indice, filas: survey.length, calculos: survey.filter((f) => f.type === "calculate").length };
}

/**
 * Reemplaza un experimento ya escrito por el diseño editado (checklist elección por pares C5). Conserva los nombres
 * que el experimento tenía (`lectura.nombres`), así que las variables que ya se analizan no cambian. Entra donde estaba
 * su primer par (o su introducción); su lista de elección se reescribe en el mismo lugar. No hace nada si una variable que desaparece se
 * usa fuera del experimento, o si un nombre nuevo choca con otra fila.
 */
export function reemplazarConjoint(
  draft: XlsformEditorWorkbook,
  lectura: LecturaConjoint,
  diseno: DisenoConjoint,
): ResultadoConjoint {
  if (!lectura.fiel) return { ok: false, motivos: [lectura.motivo ?? "El experimento no se puede editar desde aquí."] };
  const problemas = validarDiseno(diseno);
  if (problemas.length) return { ok: false, motivos: problemas };
  const { survey, choices } = generarConjoint(diseno, lectura.nombres);
  const quitar = new Set(lectura.filas);
  const nombre = (i: number) => (rowToRecord(draft.survey, i).name ?? "").trim();
  const viejos = new Set(lectura.filas.map(nombre).filter(Boolean));
  const nuevos = new Set(survey.map((f) => f.name).filter(Boolean));

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

  // Entra donde empezaban los pares (o su introducción): el sorteo que estuviera suelto más arriba se recoge adentro.
  const ancla = lectura.intro ?? lectura.pares[0]!.grupo;
  const indice = ancla - lectura.filas.filter((i) => i < ancla).length;
  [...quitar].sort((a, b) => b - a).forEach((i) => deleteRow(draft.survey, i));
  survey.forEach((f, k) => insertRecord(draft.survey, indice + k, { ...f }));

  const lista = lectura.nombres.lista;
  const deLista = draft.choices.rows.map((_, i) => i).filter((i) => (rowToRecord(draft.choices, i).list_name ?? "").trim() === lista);
  const enChoices = deLista.length ? deLista[0]! : draft.choices.rows.length;
  deLista.sort((a, b) => b - a).forEach((i) => deleteRow(draft.choices, i));
  choices.forEach((c, k) => insertRecord(draft.choices, enChoices + k, { ...c }));
  return { ok: true, rowIndex: indice, filas: survey.length, calculos: survey.filter((f) => f.type === "calculate").length };
}
