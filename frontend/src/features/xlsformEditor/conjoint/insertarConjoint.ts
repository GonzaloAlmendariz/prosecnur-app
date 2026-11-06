// Inserta un experimento conjoint generado en el formulario (E7b editor-conjoint, 2026-11-06).
// Las filas de `generarConjoint` entran juntas en el lugar del «+» y su lista de elección se agrega a choices. Si un
// nombre ya existe en el formulario no se inserta nada: un conjoint a medias es peor que ninguno.

import { indiceInsercion, type DestinoInsercion } from "../state/accionesConstructor";
import { insertRecord, rowToRecord } from "../parsing/sheetUtils";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";
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
