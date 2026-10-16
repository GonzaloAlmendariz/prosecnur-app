import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AvisoPonderacionSerie } from "./ComparativosPonderacion";
import { ColumnasDelComparativo } from "./ComparativosColumnas";
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

describe("Comparativos › columnas y ponderación de la serie", () => {
  it("una fila por base con su título y su ponderación, y el enlace a Ponderación", () => {
    const html = conRouter(createElement(ColumnasDelComparativo, {
      periodos: ["2024", "2025", "2026", "2027"],
      rotulos: { "2024": "2024" },
      ponderacion: lectura,
      onCambio: () => {},
    }));
    expect(html).toContain("Columnas del comparativo");
    expect(html).toContain("Título de la columna");
    expect(html).not.toMatch(/\b[Aa]ños?\b/);
    expect(html).toContain("Trae «factor_ponderacion» sin declarar");
    expect(html).toContain("is-sin-declarar");
    expect(html).toContain("is-sin-ponderar");
    expect(html).toContain("Sin leer aquí");
    expect(html).toContain("Columna «peso»");
    expect(html.match(/<tr>/g)?.length).toBe(5);
    expect(html).toMatch(/href="[^"]*pestana=ponderacion/);
    expect(html).toContain("Ir a Ponderación");
  });

  it("mientras lee la ponderación, cada fila lo dice y la tabla no se desarma", () => {
    const html = conRouter(createElement(ColumnasDelComparativo, {
      periodos: ["docentes", "estudiantes"],
      rotulos: {},
      ponderacion: { tipo: "cargando" },
      onCambio: () => {},
    }));
    expect(html.match(/Leyendo…/g)?.length).toBe(2);
    expect(html).toContain('placeholder="docentes"');
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
