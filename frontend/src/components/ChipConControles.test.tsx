import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CLASE_CHIP_CON_CONTROLES, ChipControl } from "./ChipConControles";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(aqui, "chipConControles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const regla = (selector: string) => css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

describe("chip con controles: radios concéntricos", () => {
  test("contenedor y control usan el mismo token de radio, sin valores sueltos", () => {
    expect(regla(`.${CLASE_CHIP_CON_CONTROLES}`)).toMatch(/border-radius:\s*var\(--pulso-radius-chip\)/);
    expect(regla(".pulso-chip-control")).toMatch(/border-radius:\s*var\(--pulso-radius-chip\)/);
    expect(css).not.toMatch(/border-radius:\s*\d/);
  });

  test("el control es un círculo inscrito: diámetro = alto − bordes − holguras, y mismo alto que ancho", () => {
    const control = regla(".pulso-chip-control");
    expect(control).toMatch(/--pulso-chip-control-diametro:\s*calc\(\s*var\(--pulso-chip-alto[^)]*\)\)\s*-\s*2px\s*-\s*2 \* var\(--pulso-chip-holgura/);
    for (const prop of ["width", "height", "min-width", "min-height"]) {
      expect(control).toMatch(new RegExp(`(^|;|\\s)${prop}:\\s*var\\(--pulso-chip-control-diametro\\)`));
    }
    expect(regla(`.${CLASE_CHIP_CON_CONTROLES}`)).toMatch(/align-items:\s*center/);
  });

  test("ChipControl es un botón con nombre accesible", () => {
    const html = renderToStaticMarkup(<ChipControl aria-label="Mover b2024 antes">↑</ChipControl>);
    expect(html).toContain('type="button"');
    expect(html).toContain('class="pulso-chip-control"');
    expect(html).toContain('aria-label="Mover b2024 antes"');
  });
});
