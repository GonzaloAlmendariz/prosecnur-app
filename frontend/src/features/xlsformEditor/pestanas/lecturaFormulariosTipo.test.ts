// Sonda opt-in: pasa TODAS las reglas de los seis formularios tipo (corpus de cliente, fuera del repo)
// por el motor de lectura (`leerRegla`) y mide cuántas caen en «técnica» por columna. Corre sólo con PULSO_CORPUS_DIR:
//   PULSO_CORPUS_DIR=~/Documents/Pulso/90_Pruebas/corpus_instrumentos pnpm -C frontend exec vitest run lecturaFormulariosTipo
// Opcionales:
//   PULSO_VOLCADO=/ruta/fuera/del/repo.json  escribe cada lectura {formulario, columna, raw, texto, tecnica}
//   PULSO_MUESTRAS=1                          imprime las técnicas agrupadas por función con un ejemplo
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import { buildDiagnostics } from "../parsing/diagnostics";
import { enriquecerAlcance, type LogicScope } from "../logic";
import type { XlsformEditorWorkbook } from "../types";
import { leerRegla } from "../reglas/leerRegla";
import { textoDePiezas, type ColumnaRegla } from "../reglas/piezas";

const DIR = process.env.PULSO_CORPUS_DIR ? path.join(process.env.PULSO_CORPUS_DIR.replace(/^~/, process.env.HOME ?? ""), "formularios_tipo_json") : "";
const activo = Boolean(DIR && existsSync(DIR));
const COLUMNAS: ColumnaRegla[] = ["relevant", "calculation", "constraint", "choice_filter", "required"];

function scopeDe(wb: XlsformEditorWorkbook) {
  const idx = buildXlsformIndex(wb);
  const scope: LogicScope = {
    variables: idx.structure.outline
      .filter((n) => n.name && n.kind !== "section" && n.kind !== "repeat")
      .map((n) => ({ rowIndex: n.rowIndex, name: n.name, label: n.label, baseType: n.typeInfo.base, listName: n.typeInfo.listName || undefined })),
    catalogsByListName: new Map(idx.catalogs.map((c) => [c.listName, { listName: c.listName, items: c.items }])),
    allowCurrent: false,
  };
  // Mismo alcance que ven las pestañas: con grupos, repeticiones y fórmulas (enriquecerAlcance).
  return { idx, scope: enriquecerAlcance(scope, idx.structure) };
}
const funcionDe = (raw: string) => (raw.match(/^\s*([a-z][a-z:-]*)\s*\(/i)?.[1] ?? (/[+\-*]| div | mod /.test(raw) ? "aritmética" : /^\s*\./.test(raw) ? "punto" : "otra"));
const esBooleano = (v: string) => /^(yes|no|true|false|1|0|si|sí)?$/i.test(v.trim()) || /^(true|false)\(\)$/i.test(v.trim());

describe.skipIf(!activo)("lectura humana sobre los seis formularios tipo", () => {
  test("mide la proporción de reglas que caen en «técnica» por columna", () => {
    const cuenta = new Map<ColumnaRegla, [number, number]>(COLUMNAS.map((c) => [c, [0, 0]]));
    const porFuncion = new Map<string, { n: number; ejemplo: string }>();
    const volcado: { formulario: string; columna: ColumnaRegla; raw: string; texto: string; tecnica: boolean; tipo: string }[] = [];
    const filasRotas: string[] = [];
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
      const wb = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as XlsformEditorWorkbook & { titulo: string };
      const { idx, scope } = scopeDe(wb);
      for (const d of buildDiagnostics(wb, idx)) if (d.id.startsWith("fila-rota-")) filasRotas.push(`${wb.titulo}: ${idx.structure.outline.find((n) => n.rowIndex === d.rowIndex)?.name}`);
      for (const n of idx.structure.outline) {
        const requerido = rowToRecord(wb.survey, n.rowIndex).required ?? "";
        const crudos: Record<ColumnaRegla, string> = {
          relevant: n.relevant,
          calculation: n.calculation,
          constraint: n.constraint,
          choice_filter: n.choiceFilter,
          required: esBooleano(requerido) ? "" : requerido,
        };
        for (const col of COLUMNAS) {
          const raw = crudos[col].trim();
          if (!raw) continue;
          const l = leerRegla(col, raw, n, scope);
          const par = cuenta.get(col)!;
          par[0]++;
          if (l.tecnica) {
            par[1]++;
            const k = `${col}:${funcionDe(raw)}`;
            const prev = porFuncion.get(k);
            porFuncion.set(k, { n: (prev?.n ?? 0) + 1, ejemplo: prev?.ejemplo ?? raw.slice(0, 110) });
          }
          volcado.push({ formulario: wb.titulo, columna: col, raw, texto: textoDePiezas(l.piezas), tecnica: l.tecnica, tipo: n.typeInfo.base });
        }
      }
    }
    if (process.env.PULSO_VOLCADO) writeFileSync(process.env.PULSO_VOLCADO, JSON.stringify(volcado, null, 1));
    if (process.env.PULSO_VOLCADO) writeFileSync(`${process.env.PULSO_VOLCADO}.filas-rotas.txt`, filasRotas.join("\n"));
    const top = [...porFuncion.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30).map(([k, v]) => `  ${String(v.n).padStart(4)}  ${k.padEnd(34)} ${v.ejemplo}`);
    const filas = COLUMNAS.map((c) => {
      const [n, t] = cuenta.get(c)!;
      return `${c.padEnd(14)} ${String(n - t).padStart(5)}/${String(n).padEnd(5)} traducidas (${Math.round((100 * (n - t)) / Math.max(n, 1))} %)`;
    });
    console.log(["", ...filas, `Filas rotas: ${filasRotas.join(", ") || "ninguna"}`, ...(process.env.PULSO_MUESTRAS ? ["Técnicas por función:", ...top] : [])].join("\n"));
    expect(volcado.length).toBeGreaterThan(0);
  });
});
