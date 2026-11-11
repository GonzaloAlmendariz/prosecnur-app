import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cajasDeLaHoja } from "../../test/cajasPropias";

/**
 * **P2 de la pasada de formato de Analítica — un bloque con marco es un `Panel`** (4 nov 2026).
 *
 * Cuenta, por hoja, las reglas que dibujan una caja (borde sólido, radio y padding en la misma regla)
 * y sólo deja que bajen. Pasaron al kit Presentación, Columnas del comparativo y el Resultado de Comparativos
 * (62 → 60). La pastilla "Manifest" del resultado salió con la descarga al contenedor de entregables (ADR 0133,
 * fase 5; ComparativosPane.css 11 → 10). En Ponderación las tarjetas y el veredicto pasaron a `Panel` y `Alert`
 * (PonderacionPane.css 3 → 1; queda el aviso que usa `PoblacionDeReferencia`). La lista de preguntas es un `fieldset` con su `legend`: `Panel` le quitaría esa semántica, y comparte
 * la regla `.pulso-comparativos-bloque`. Lo demás son controles, filas y avisos (`docs/qa/formato-analitica-2026-11-04.md`).
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function hojas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return hojas(completo);
    return e.name.endsWith(".css") ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");


/** Foto del 4 nov 2026. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "analitica-v2.css": 37,
  "cifrasPestana.css": 1,
  "panes/CodebookPane.css": 1,
  "panes/ComparativosPane.css": 10,
  "panes/DataReviewPane.css": 2,
  "panes/PesoPorColumna.css": 2,
  "panes/PonderacionPane.css": 1,
  "variablesExcluidas.css": 4,
};

describe("cajas propias de Analítica (P2)", () => {
  const conteo: Record<string, number> = {};
  for (const f of hojas(aqui)) {
    const n = cajasDeLaHoja(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ninguna hoja suma cajas propias ni aparece una nueva", () => {
    expect(hojas(aqui).length).toBeGreaterThan(8);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Un bloque con marco es components/Panel.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("el detector reconoce una caja", () => {
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja(".a { border-radius: 4px; padding: 8px; }")).toBe(0);
    // Una caja repartida en dos reglas también es caja (el punto ciego que dejó pasar `.cmv2-panel` y `SettingBlock`).
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; }\n.b { color: red; }\n.a { padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja("@media (max-width: 800px) { .a { padding: 8px; } }\n.a { border: 1px solid red; border-radius: 4px; }")).toBe(1);
  });
});
