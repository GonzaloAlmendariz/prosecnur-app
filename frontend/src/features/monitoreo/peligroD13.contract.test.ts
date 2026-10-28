// D13 (Gonzalo, 2026-10-11: «Cambiar --danger»): lo destructivo de Monitoreo
// va en el rojo vivo `--pulso-danger-solid`, distinto del carmesí del módulo y
// del rojo oscuro `--pulso-danger-fg` de los avisos. Un botón `.is-peligro`
// pintado con `--pulso-danger-fg` se lee como un aviso, no como «borrar».
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname);

function hojas(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return hojas(ruta);
    return ruta.endsWith(".css") ? [ruta] : [];
  });
}

/** Bloques cuyo selector nombra un botón `.is-peligro` (no un aviso de texto). */
function bloquesDePeligro(css: string): { selector: string; cuerpo: string }[] {
  const bloques: { selector: string; cuerpo: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (/boton[^,{]*\.is-peligro/.test(selector)) bloques.push({ selector, cuerpo: m[2] });
  }
  return bloques;
}

describe("D13: lo destructivo de Monitoreo va en el rojo del kit", () => {
  const bloques = hojas(RAIZ).flatMap((ruta) =>
    bloquesDePeligro(readFileSync(ruta, "utf8")).map((b) => ({ ...b, ruta: ruta.slice(RAIZ.length + 1) })),
  );

  it("encuentra los botones destructivos (centinela: el contrato no está ciego)", () => {
    expect(bloques.length).toBeGreaterThanOrEqual(4);
  });

  it("ningún botón .is-peligro usa el rojo de los avisos", () => {
    const malos = bloques
      .filter((b) => /--pulso-danger-fg/.test(b.cuerpo))
      .map((b) => `${b.ruta}: ${b.selector}`);
    expect(malos).toEqual([]);
  });
});
