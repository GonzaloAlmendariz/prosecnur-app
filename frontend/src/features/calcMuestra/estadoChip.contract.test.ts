import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P6 de la pasada de formato — un estado es un `EstadoChip`, no una píldora.**
 *
 * `cmv2-pill-soft` servía para todo: el estado de un bloque («lista para
 * calcular», «en preparación», «falta el enlace»), pegado al botón que lo
 * cambia, y también notas sueltas («viaja con el plan»). Los estados pasaron al
 * `EstadoChip` del kit (tono, mayúscula inicial, separado de la acción). Las
 * píldoras que quedan son notas; este ratchet sólo deja que bajen.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function componentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : componentes(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** `cmv2-pill-soft` por archivo al 2 nov 2026, después de pasar los estados a EstadoChip. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "general/MemoriaCalculoGeneral.tsx": 1,
  "universidad/calculo/CalculoDisenoTab.tsx": 2,
  "universidad/calculo/CalculoPropuestasTab.tsx": 1,
  "universidad/salidas/HistorialCorridas.tsx": 1,
};

describe("estados por EstadoChip · P6", () => {
  const conteo: Record<string, number> = {};
  for (const f of componentes(aqui)) {
    const n = readFileSync(f, "utf8").match(/cmv2-pill-soft/g)?.length ?? 0;
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ningún archivo suma píldoras ni aparece uno nuevo", () => {
    expect(componentes(aqui).length).toBeGreaterThan(200);
    const usos = componentes(aqui).reduce((n, f) => n + (readFileSync(f, "utf8").match(/<EstadoChip\b/g)?.length ?? 0), 0);
    expect(usos).toBeGreaterThan(4);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Un estado es EstadoChip de components/; una nota no necesita píldora.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    expect(Object.keys(SNAPSHOT).length).toBeGreaterThan(2);
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });
});
