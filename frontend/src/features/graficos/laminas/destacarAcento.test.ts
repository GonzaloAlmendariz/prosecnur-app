// R7-14: el estado activo de Destacar usa el acento del módulo, no el rojo de peligro.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "datosGrafico.css"), "utf8");
const regla = (selector: string) => {
  const i = css.indexOf(selector);
  return i < 0 ? "" : css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
};

describe("Destacar activo", () => {
  it("lleva el acento del módulo y no el tono de peligro", () => {
    const activa = regla('.pulso-f6-destacar-opcion[aria-pressed="true"] {');
    expect(activa).toContain("var(--module-accent)");
    expect(activa).not.toContain("danger");
  });
});
