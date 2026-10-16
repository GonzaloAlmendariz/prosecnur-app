import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AvisoPonderacionSerie, PonderacionDeLaSerieLinea } from "./ComparativosPonderacion";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";

const lectura: LecturaPonderacionSerie = {
  tipo: "listo",
  serie: [
    { base: "2024", ponderacion: { tipo: "sin_declarar", columnasPeso: ["factor_ponderacion"] } },
    { base: "2025", ponderacion: { tipo: "sin_leer" } },
    { base: "2026", ponderacion: { tipo: "columna", columna: "peso" } },
    { base: "2027", ponderacion: { tipo: "sin_declarar", columnasPeso: [] } },
  ],
};

const conRouter = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, el));

describe("Comparativos › ponderación de la serie", () => {
  it("una línea con cada base y el enlace a Ponderación", () => {
    const html = conRouter(createElement(PonderacionDeLaSerieLinea, { lectura }));
    expect(html).toContain("<strong>2024</strong> trae «factor_ponderacion» sin declarar");
    expect(html).toContain("<strong>2027</strong> sin ponderar");
    expect(html).toContain("is-sin-ponderar");
    expect(html).toContain("<strong>2025</strong> sin leer aquí");
    expect(html).toContain("<strong>2026</strong> columna «peso»");
    expect(html).toContain("is-sin-declarar");
    expect(html).toMatch(/href="[^"]*pestana=ponderacion/);
    expect(html).toContain("Ir a Ponderación");
  });

  it("el aviso previo nombra la base con peso sin declarar, enlaza a Ponderación, y no aparece si no falta nada", () => {
    const aviso = conRouter(createElement(AvisoPonderacionSerie, { lectura }));
    expect(aviso).toContain("2024 trae «factor_ponderacion» sin declarar: el comparativo la toma sin ponderar.");
    expect(aviso).not.toContain("2027");
    expect(aviso).toMatch(/href="[^"]*pestana=ponderacion/);
    expect(aviso).toContain("Declarar en Ponderación");
    const sinFaltas: LecturaPonderacionSerie = {
      tipo: "listo",
      serie: [
        { base: "2024", ponderacion: { tipo: "sin_ponderar" } },
        // Sin columnas de peso: «sin ponderar», no un pendiente.
        { base: "2026", ponderacion: { tipo: "sin_declarar", columnasPeso: [] } },
      ],
    };
    expect(conRouter(createElement(AvisoPonderacionSerie, { lectura: sinFaltas }))).toBe("");
    expect(conRouter(createElement(AvisoPonderacionSerie, { lectura: { tipo: "cargando" } }))).toBe("");
  });
});
