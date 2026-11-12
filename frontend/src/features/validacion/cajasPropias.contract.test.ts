import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cajasDeLaHoja } from "../../test/cajasPropias";

/**
 * **Cajas propias de Validación: un bloque con marco es un `Panel`** (P6, rebanada V1, 11 nov 2026).
 *
 * Copia del trinquete de Codificación: cuenta, por hoja, los selectores que dibujan una caja (borde
 * sólido, radio y padding, sumando todas sus reglas) y sólo deja que bajen. La foto se tomó tras
 * quitar el CSS muerto `.pulso-regla-design-*`. Las cajas escritas en estilos en línea del JSX no
 * entran en esta cuenta: las rebanadas V3 a V5 las retiran al rehacer cada pestaña.
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

/** Foto del 11 nov 2026. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "components/ruleDetail.css": 4,
  "tabs/explorar/explorar.css": 4,
  "validacion-v2.css": 29,
};

describe("cajas propias de Validación", () => {
  const conteo: Record<string, number> = {};
  for (const f of hojas(aqui)) {
    const n = cajasDeLaHoja(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ninguna hoja suma cajas propias ni aparece una nueva", () => {
    expect(hojas(aqui).length).toBeGreaterThan(4);
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
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; }\n.b { color: red; }\n.a { padding: 8px; }")).toBe(1);
  });
});
