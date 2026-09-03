import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { COLUMNAS_DE_NOTA, NotaEnCelda } from "./NotaEnCelda";

/**
 * B42 (dictado 2026-09-02): las observaciones van plegadas en «un pequeño
 * botón… donde si le das clic puedes ver qué se comenta… pero que no ocupe
 * demasiado espacio», y cada familia —agendación, aplicación— llega
 * distinguida por su columna y su encabezado.
 */
describe("NotaEnCelda", () => {
  it("nace plegada: el botón chiquito, y la nota con su familia declarada", () => {
    const html = renderToStaticMarkup(<NotaEnCelda texto="El docente pide llegar 10 min antes" origen="agendación" />);
    expect(html).toContain("<details");
    expect(html).not.toContain("open");
    expect(html).toContain('aria-label="Ver la observación de agendación"');
    expect(html).toContain("<strong>agendación</strong>");
    expect(html).toContain("El docente pide llegar 10 min antes");
  });

  it("sin nota no hay botón: cien iconos muertos no son acceso", () => {
    expect(renderToStaticMarkup(<NotaEnCelda texto="   " origen="aplicación" />)).toBe("");
  });

  it("las dos familias del libro están declaradas; las abiertas de plataforma NO pasan por aquí", () => {
    expect(COLUMNAS_DE_NOTA.get("replacement_note")).toBe("agendación");
    expect(COLUMNAS_DE_NOTA.get("field_note")).toBe("aplicación");
    expect(COLUMNAS_DE_NOTA.size).toBe(2);
  });
});
