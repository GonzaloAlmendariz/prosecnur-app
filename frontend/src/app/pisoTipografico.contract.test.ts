import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L29 — nada se escribe por debajo del piso de 10 px.**
 *
 * La escala por rol (app/tipografia.css) termina en `micro`, 10 px. Este
 * ratchet cuenta los `font-size` literales menores de 10 px por archivo CSS y
 * sólo deja que bajen: un archivo nuevo o uno que suma falla. Al subir uno al
 * piso (o pasarlo a `var(--pulso-type-micro-size)`) se baja su conteo aquí.
 * Foto del 2026-10-28: 36 archivos, 90 declaraciones. Monitoreo fuera
 * mientras lo trabaja su sesión.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUERA_DE_ALCANCE = ["features/monitoreo/"];
const BAJO_EL_PISO = /font-size\s*:\s*(\d+(?:\.\d+)?)px/g;

const SNAPSHOT_BAJO_10PX: Record<string, number> = {
  "features/calcMuestra/universidad/aulas/relato/relato.css": 3,
  "features/calcMuestra/universidad/definicion/historicoEstudio.css": 8,
  "features/calcMuestra/universidad/universidad-base.css": 1,
  "features/graficos/estilo/estilo.css": 1,
  "features/graficos/graficadorPicker.css": 9,
  "features/graficos/v2/styles/editor-v2.css": 2,
  "features/graficos/v2/timeline/slidePicker.css": 6,
  "features/recopiladores/styles/plan.css": 1,
};

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta);
    return entrada.name.endsWith(".css") ? [ruta] : [];
  });
}

function conteoActual(): { conteo: Record<string, number>; hojas: number } {
  const conteo: Record<string, number> = {};
  let hojas = 0;
  for (const ruta of archivos(SRC)) {
    const archivo = path.relative(SRC, ruta).split(path.sep).join("/");
    if (FUERA_DE_ALCANCE.some((prefijo) => archivo.startsWith(prefijo))) continue;
    hojas += 1;
    const css = fs.readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const n = [...css.matchAll(BAJO_EL_PISO)].filter(([, px]) => Number(px) < 10).length;
    if (n > 0) conteo[archivo] = n;
  }
  return { conteo, hojas };
}

describe("piso tipográfico de 10 px · L29", () => {
  const { conteo, hojas } = conteoActual();

  test("el barrido ve las hojas de estilo: si deja de casar, no puede quedar verde", () => {
    expect(hojas).toBeGreaterThan(100);
  });

  test("ningún archivo suma letra bajo 10 px ni aparece uno nuevo", () => {
    const regresiones = Object.entries(conteo)
      .filter(([archivo, n]) => n > (SNAPSHOT_BAJO_10PX[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT_BAJO_10PX[archivo] ?? 0} → ${n}`);
    expect(regresiones, "El piso es 10 px: usa var(--pulso-type-micro-size).").toEqual([]);
  });

  test("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT_BAJO_10PX)
      .filter(([archivo, n]) => (conteo[archivo] ?? 0) < n)
      .map(([archivo, n]) => `${archivo}: ${n} → ${conteo[archivo] ?? 0}`);
    expect(viejos).toEqual([]);
  });
});
