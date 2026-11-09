// R7-14: el estado activo de Destacar usa el acento del módulo, no el rojo de peligro. W3: la ficha es ChipSeleccion del
// kit; el tinte activo vive en kit-chip-seleccion.css y Destacar ya no pinta el suyo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const kit = fs.readFileSync(path.join(aqui, "../../../components/kit-chip-seleccion.css"), "utf8");
const datos = fs.readFileSync(path.join(aqui, "datosGrafico.css"), "utf8");
const regla = (css: string, selector: string) => {
  const i = css.indexOf(selector);
  return i < 0 ? "" : css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
};

describe("Destacar activo", () => {
  it("lleva el acento del módulo y no el tono de peligro", () => {
    const activa = regla(kit, ".pulso-chip-seleccion.is-activo {");
    expect(activa).toContain("--module-accent-border");
    expect(activa).toContain("--module-accent-soft");
    expect(activa).not.toContain("danger");
  });

  it("W3: Destacar no repinta su ficha activa", () => {
    expect(datos).not.toContain('.pulso-f6-destacar-opcion[aria-pressed="true"]');
  });
});
