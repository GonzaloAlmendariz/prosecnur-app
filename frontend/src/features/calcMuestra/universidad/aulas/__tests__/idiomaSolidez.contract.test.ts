/**
 * Contrato de idioma de Solidez (plan 1b, E17). Fija por FUENTE que la
 * radiografía y sus vecinas hablan la ecuación condicional V7 y el
 * vocabulario nuevo; el mutante que lo revierte se pone rojo con el porqué.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (rel: string) =>
  readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("idioma de Solidez de la selección", () => {
  it("la radiografía es condicional: sin el docente en la multiplicación", () => {
    const card = src("EfectividadExplicadaCard.tsx");
    // El paso del docente no vuelve a la cuenta…
    expect(card).not.toContain("tasa de aplicación de su tipo de docente");
    // …vive como dato operativo declarado.
    expect(card).toContain("Dato operativo");
    expect(card).toContain("no descuenta las esperadas");
  });

  it("el modelo calcula el producto exacto SIN la tasa de aplicación", () => {
    const model = src("efectividadExplicadaModel.ts");
    expect(model).toContain("productoExacto: el * r * factor");
    expect(model).not.toContain("productoExacto: el * p * r * factor");
  });

  it("la tabla de docentes vive en el Presupuesto, no en la radiografía", () => {
    expect(src("EfectividadExplicadaCard.tsx")).not.toContain("según el tipo de docente");
    expect(src("PresupuestoVisitasCard.tsx")).toContain("anticipa intentos y cadena, no efectivas");
  });

  it("los nombres viejos de la vara no vuelven", () => {
    for (const f of [
      "EfectividadExplicadaCard.tsx",
      "SustentoDimensionamientoCard.tsx",
      "SeleccionPorFacultadCard.tsx",
      "CertificacionFacultadCard.tsx",
    ]) {
      expect(src(f), `"tasa de respuesta" en ${f}`).not.toContain("tasa de respuesta");
      expect(src(f), `τ en ${f}`).not.toMatch(/τ/);
    }
  });
});
