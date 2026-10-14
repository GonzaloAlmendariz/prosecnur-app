import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EstadoVacio } from "./EstadoVacio";

describe("EstadoVacio", () => {
  it("pinta ícono, título y una línea en compacto por defecto", () => {
    const html = renderToStaticMarkup(
      <EstadoVacio icono={<svg data-icono="x" />} titulo="Sin variables" descripcion="Añade una para empezar." />,
    );
    expect(html).toContain('class="pulso-estado-vacio pulso-estado-vacio--compacto"');
    expect(html).toContain('data-estado-vacio="compacto"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Sin variables");
    expect(html).toContain("Añade una para empezar.");
    expect(html).not.toContain("pulso-estado-vacio-accion");
  });

  it("admite el tamaño normal y una acción opcional", () => {
    const html = renderToStaticMarkup(
      <EstadoVacio
        tamano="normal"
        icono={<svg />}
        titulo="Nada que comparar"
        accion={<button type="button">Elegir preguntas</button>}
      />,
    );
    expect(html).toContain("pulso-estado-vacio--normal");
    expect(html).toContain("pulso-estado-vacio-accion");
    expect(html).toContain("Elegir preguntas");
    expect(html).not.toContain("pulso-estado-vacio-descripcion");
  });

  it("la hoja solo usa tokens y sin min-height que fabrique capacidad", () => {
    const css = fs.readFileSync(path.join(__dirname, "EstadoVacio.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/min-height/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
