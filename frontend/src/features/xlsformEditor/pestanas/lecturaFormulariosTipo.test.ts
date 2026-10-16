// Sonda opt-in: pasa TODAS las reglas de los seis formularios tipo (corpus de cliente, fuera del repo)
// por la lectura humana, y mide cuántas caen en «técnica». Corre sólo con PULSO_CORPUS_DIR:
//   PULSO_CORPUS_DIR=~/Documents/Pulso/90_Pruebas/corpus_instrumentos pnpm -C frontend exec vitest run lecturaFormulariosTipo
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { describeExpression, describeValidation } from "../canvas/reglasHumanas";
import type { LogicScope } from "../logic";
import type { XlsformEditorWorkbook } from "../types";
import { evaluarRestriccion, valoresDeEjemplo } from "../logic/probarRestriccion";

const DIR = process.env.PULSO_CORPUS_DIR ? path.join(process.env.PULSO_CORPUS_DIR.replace(/^~/, process.env.HOME ?? ""), "formularios_tipo_json") : "";
const activo = Boolean(DIR && existsSync(DIR));

function scopeDe(wb: XlsformEditorWorkbook) {
  const idx = buildXlsformIndex(wb);
  const scope: LogicScope = {
    variables: idx.structure.outline
      .filter((n) => n.name && n.kind !== "section" && n.kind !== "repeat")
      .map((n) => ({ rowIndex: n.rowIndex, name: n.name, label: n.label, baseType: n.typeInfo.base, listName: n.typeInfo.listName || undefined })),
    catalogsByListName: new Map(idx.catalogs.map((c) => [c.listName, { listName: c.listName, items: c.items }])),
    allowCurrent: false,
  };
  return { idx, scope };
}
const funcionDe = (raw: string) => (raw.match(/^\s*([a-z][a-z-]*)\s*\(/i)?.[1] ?? (/[+\-*]| div | mod /.test(raw) ? "aritmética" : /^\s*\./.test(raw) ? "punto" : "otra"));

describe.skipIf(!activo)("lectura humana sobre los seis formularios tipo", () => {
  test("mide la proporción de reglas que caen en «técnica» por columna y formulario", () => {
    const filas: string[] = [];
    const porFuncion = new Map<string, { n: number; ejemplo: string }>();
    const muestras = new Map<string, string[]>();
    let restricciones = 0;
    let probables = 0;
    const fueraPorTipo = new Map<string, number>();
    let total = 0;
    let tecnicas = 0;
    let mayuscula = 0;
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
      const wb = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as XlsformEditorWorkbook & { titulo: string };
      const { idx, scope } = scopeDe(wb);
      const c = { constraint: [0, 0], relevant: [0, 0], calculation: [0, 0] } as Record<string, [number, number]>;
      for (const n of idx.structure.outline) {
        const casos: [string, string, string][] = [];
        if (n.constraint.trim()) {
          restricciones++;
          const vals = valoresDeEjemplo(n, idx.catalogs.find((c) => c.listName === n.typeInfo.listName)?.items.map((i) => i.name) ?? []);
          if (vals.length && vals.some((v) => evaluarRestriccion(n.constraint, v) !== "no-evaluable")) probables++;
          else fueraPorTipo.set(`${n.typeInfo.base}${vals.length ? " (no evaluable)" : " (sin valores)"}`, (fueraPorTipo.get(`${n.typeInfo.base}${vals.length ? " (no evaluable)" : " (sin valores)"}`) ?? 0) + 1);
        }
        if (n.constraint.trim()) casos.push(["constraint", n.constraint, describeValidation(n.constraint, n, scope)?.summary ?? ""]);
        if (n.relevant.trim()) casos.push(["relevant", n.relevant, describeExpression(n.relevant, scope).summary]);
        if (n.calculation.trim()) casos.push(["calculation", n.calculation, describeExpression(n.calculation, scope).summary]);
        for (const [col, raw, lee] of casos) {
          c[col][0]++;
          total++;
          if (/[ ](y|o) La /.test(lee)) mayuscula++;
          const km = `${col}:${funcionDe(raw)}`;
          const lm = muestras.get(km) ?? [];
          if (lm.length < 2) muestras.set(km, [...lm, `${raw.slice(0, 90)}\n        → ${lee.slice(0, 160)}`]);
          if (/técnica/i.test(lee)) {
            c[col][1]++;
            tecnicas++;
            const k = `${col}:${funcionDe(raw)}`;
            const prev = porFuncion.get(k);
            porFuncion.set(k, { n: (prev?.n ?? 0) + 1, ejemplo: prev?.ejemplo ?? raw.slice(0, 110) });
          }
        }
      }
      filas.push(`${wb.titulo.padEnd(42)} constraint ${c.constraint[1]}/${c.constraint[0]} · relevant ${c.relevant[1]}/${c.relevant[0]} · calculation ${c.calculation[1]}/${c.calculation[0]}`);
    }
    const top = [...porFuncion.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k, v]) => `  ${String(v.n).padStart(4)}  ${k.padEnd(34)} ${v.ejemplo}`);
    if (process.env.PULSO_MUESTRAS) console.log([...muestras.entries()].map(([k, v]) => `${k}\n      ${v.join("\n      ")}`).join("\n"));
    console.log(["", ...filas, `PROBAR VALORES: ${probables}/${restricciones} restricciones se pueden probar en el editor · fuera: ${[...fueraPorTipo.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`, `TOTAL técnicas ${tecnicas}/${total} (${Math.round((100 * tecnicas) / Math.max(total, 1))} %) · «y La» ${mayuscula}`, "Por función:", ...top].join("\n"));
    expect(total).toBeGreaterThan(0);
  });
});
