/**
 * L24 del loop de mejoras (2026-09-27): a 1024x600 el chip de estado del
 * encabezado cedía ancho (flex-shrink 1): su texto medía 140 px en una caja de
 * 132 y se derramaba sobre «Siguiente». El que se recorta es el texto de la
 * condición, que ya tiene elipsis; el chip no cede.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("chip de estado del encabezado", () => {
  it("no cede ancho en la fila", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "mesa.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const regla = /\.cmg-estado-chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(regla).toMatch(/flex-shrink:\s*0/);
  });
});
