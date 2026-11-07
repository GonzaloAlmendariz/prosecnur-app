// Escribe en el formulario lo que arma el armador de cálculos (E19-3 = E17b editor-conjoint, 2026-11-06): la fórmula en
// la fila del cálculo y, si hace falta, las filas auxiliares antes de ella (el número al azar de un sorteo). Una fila
// auxiliar que ya existe con la misma fórmula se reutiliza; si el nombre está tomado por otra cosa no se escribe nada.

import { insertRecord, rowToRecord, setCell } from "../../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../../types";

export type ResultadoArmado = { ok: true; filaCalculo: number } | { ok: false; motivo: string };

export function aplicarArmado(
  draft: XlsformEditorWorkbook,
  filaCalculo: number,
  formula: string,
  auxiliares: readonly { name: string; calculation: string }[],
): ResultadoArmado {
  const survey = draft.survey;
  if (filaCalculo < 0 || filaCalculo >= survey.rows.length) return { ok: false, motivo: "La fila del cálculo ya no existe." };
  const filaDe = new Map<string, number>();
  survey.rows.forEach((_, i) => {
    const n = (rowToRecord(survey, i).name ?? "").trim();
    if (n && !filaDe.has(n)) filaDe.set(n, i);
  });
  const nuevas: { name: string; calculation: string }[] = [];
  for (const a of auxiliares) {
    const i = filaDe.get(a.name);
    if (i === undefined) { nuevas.push(a); continue; }
    const r = rowToRecord(survey, i);
    if ((r.calculation ?? "").trim() !== a.calculation || i > filaCalculo) {
      return { ok: false, motivo: `El nombre «${a.name}» ya lo usa otra fila del formulario. Elige otro.` };
    }
  }
  nuevas.forEach((a, k) => insertRecord(survey, filaCalculo + k, { type: "calculate", name: a.name, calculation: a.calculation }));
  const fila = filaCalculo + nuevas.length;
  setCell(survey, fila, "calculation", formula);
  return { ok: true, filaCalculo: fila };
}
