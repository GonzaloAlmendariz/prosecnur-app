import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AvisoPonderacionSerie, PonderacionDeLaSerieLinea } from "./ComparativosPonderacion";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";

const lectura: LecturaPonderacionSerie = {
  tipo: "listo",
  serie: [
    { base: "2024", ponderacion: { tipo: "sin_declarar" } },
    { base: "2025", ponderacion: { tipo: "sin_leer" } },
    { base: "2026", ponderacion: { tipo: "columna", columna: "peso" } },
  ],
};

const conRouter = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, el));

describe("Comparativos › ponderación de la serie", () => {
  it("una línea con cada base y el enlace a Ponderación", () => {
    const html = conRouter(createElement(PonderacionDeLaSerieLinea, { lectura }));
    expect(html).toContain("<strong>2024</strong> sin peso declarado");
    expect(html).toContain("<strong>2025</strong> sin leer aquí");
    expect(html).toContain("<strong>2026</strong> columna «peso»");
    expect(html).toContain("is-sin-declarar");
    expect(html).toMatch(/href="[^"]*pestana=ponderacion/);
    expect(html).toContain("Ir a Ponderación");
  });

  it("el aviso previo nombra la base sin declarar y no aparece si todas declaran", () => {
    expect(renderToStaticMarkup(createElement(AvisoPonderacionSerie, { lectura })))
      .toContain("2024 no declara su ponderación");
    const sinFaltas: LecturaPonderacionSerie = { tipo: "listo", serie: [{ base: "2024", ponderacion: { tipo: "sin_ponderar" } }] };
    expect(renderToStaticMarkup(createElement(AvisoPonderacionSerie, { lectura: sinFaltas }))).toBe("");
    expect(renderToStaticMarkup(createElement(AvisoPonderacionSerie, { lectura: { tipo: "cargando" } }))).toBe("");
  });
});
