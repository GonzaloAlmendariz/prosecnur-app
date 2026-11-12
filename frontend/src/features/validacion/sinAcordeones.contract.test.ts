import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Validación sin acordeones** (P6 del rediseño de Procesamiento, rebanada V1, 11 nov 2026).
 *
 * Lo que la vista tiene que mostrar se muestra; no se esconde detrás de un plegado. Este trinquete
 * cuenta, por archivo, los acordeones de hoy y solo deja que bajen:
 *
 * - un `<details>` (con su `<summary>`);
 * - un botón que pliega una sección (`aria-expanded`), salvo el "Ver más" de una lista larga
 *   (`vx-ver-mas`), que alarga la misma lista y no esconde otra cosa.
 *
 * Un selector que abre su lista de opciones también lleva `aria-expanded` y no es un acordeón:
 * esos van en `SELECTORES`, con el porqué. El historial plegado de la decisión salió con
 * `limpieza/EditorDeDecision.tsx`, retirado el 12 nov 2026.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return e.name.endsWith(".tsx") && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** Desplegables que abren una lista de opciones: no esconden contenido de la vista. */
const SELECTORES: Record<string, string> = {
  "components/RepeatDimensionBar.tsx": "elige el servicio analizado de una lista",
};

/** Acordeones en una línea de código. */
export function acordeonesEn(linea: string): number {
  if (/^\s*(\/\/|\*)/.test(linea)) return 0;
  const details = (linea.match(/<details\b/g) ?? []).length;
  const plegado = /aria-expanded=/.test(linea) && !/vx-ver-mas/.test(linea) ? 1 : 0;
  return details + plegado;
}

/** Foto del 11 nov 2026, tras partir Instrumento y Limpieza. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "components/InstrumentoOperationalControls.tsx": 1,
  "components/VariablePicker.tsx": 1,
  "instrumento/GruposDeReglas.tsx": 1,
  "tabs/explorar/Cruce.tsx": 1,
};

describe("acordeones de Validación", () => {
  const conteo: Record<string, number> = {};
  for (const f of fuentes(aqui)) {
    if (SELECTORES[rel(f)]) continue;
    const n = readFileSync(f, "utf8").split("\n").reduce((t, l) => t + acordeonesEn(l), 0);
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ningún archivo suma acordeones ni aparece uno nuevo", () => {
    expect(fuentes(aqui).length).toBeGreaterThan(70);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Lo que la vista promete se muestra a la vista, no plegado.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("el detector reconoce un acordeón y deja pasar el Ver más", () => {
    expect(acordeonesEn('<details open={x} onToggle={y}>')).toBe(1);
    expect(acordeonesEn("        aria-expanded={!collapsed}")).toBe(1);
    expect(acordeonesEn('<button type="button" className="vx-ver-mas" aria-expanded={todas}>')).toBe(0);
    expect(acordeonesEn("// un <details> en un comentario")).toBe(0);
  });
});
