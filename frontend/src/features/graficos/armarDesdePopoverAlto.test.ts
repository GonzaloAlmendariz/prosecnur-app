import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// C4 (QA en vivo Meta A, 1024x600): en la barra de Láminas el popover de «Armar desde…» nace con su borde superior a
// 176 px y la base (`calc(100vh - 170px)`) lo dejaba terminar en 606 > 600. El override de la barra debe restar al
// menos ese top para que el borde inferior quede dentro de la ventana en toda la matriz de viewports.

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "armarDesde/armarDesde.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const TOP_MEDIDO = 176;
const ALTOS = [1107, 1000, 768, 720, 600];

describe("«Armar desde…» en la barra común cabe en la ventana", () => {
  it("max-height del popover en .pulso-f6-barra descuenta su top real", () => {
    const regla = css.match(/\.pulso-f6-barra \.pulso-gv2-suggest-popover\s*\{([^}]*)\}/);
    expect(regla).not.toBeNull();
    const m = (regla?.[1] ?? "").match(/max-height:\s*min\(\s*(\d+)px\s*,\s*calc\(100d?vh\s*-\s*(\d+)px\)\s*\)/);
    expect(m).not.toBeNull();
    const tope = Number(m?.[1]);
    const resta = Number(m?.[2]);
    for (const alto of ALTOS) {
      const maxH = Math.min(tope, alto - resta);
      expect(maxH).toBeGreaterThan(0);
      expect(TOP_MEDIDO + maxH).toBeLessThanOrEqual(alto);
    }
  });
});
