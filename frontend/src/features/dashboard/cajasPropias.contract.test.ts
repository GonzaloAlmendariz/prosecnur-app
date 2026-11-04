import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P2 de la pasada de formato del Dashboard — un bloque con marco es un `Panel`** (4 nov 2026).
 *
 * Cuenta, por hoja, las reglas que dibujan una caja (borde sólido, radio y padding en la misma regla)
 * y sólo deja que bajen. Los grupos de ajustes del editor de personalización (`SettingBlock`) son Panel; el conteo sigue en 84
 * porque su caja tenía el borde en una regla y el relleno en otra, y el detector sólo ve las que traen los tres juntos.
 * El resto es el tablero publicado (`tabs/`, `theme/tokens.css`), con el tema que ve el cliente, y las tarjetas de
 * opción del editor: se quedan (`docs/qa/formato-dashboard-2026-11-04.md`).
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

function cajasDeLaHoja(css: string): number {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .filter((b) => /border\s*:[^;]*solid/.test(b) && /border-radius/.test(b) && /padding/.test(b)).length;
}

/** Foto del 4 nov 2026. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "customize/customize.css": 16,
  "shared/fullscreen.css": 2,
  "tabs/BaseDatosTab/baseDatos.css": 5,
  "tabs/DimensionesTab/dimensiones.css": 9,
  "tabs/DimensionesTab/foda.css": 10,
  "tabs/DimensionesTab/indicador-assembly.css": 2,
  "tabs/DimensionesTab/matriz_unidades.css": 3,
  "tabs/RelacionTab/relacion.css": 1,
  "theme/tokens.css": 36,
};

describe("cajas propias del Dashboard (P2)", () => {
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
  });
});
