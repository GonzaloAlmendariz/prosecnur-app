/**
 * Contrato de idioma del revamp de Cursos-horario requeridos (E9/E10,
 * mandato de Gonzalo: «no está hablando el mismo idioma que el resto de
 * indicadores»). Fija por FUENTE que la pestaña conserva la cadena completa
 * y el vocabulario nuevo; si alguien la devuelve a la jerga vieja, esto
 * se pone rojo con el porqué.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (rel: string) =>
  readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("idioma de Cursos-horario requeridos", () => {
  it("la tabla principal enseña la tasa de efectividad (la cadena no se rompe)", () => {
    const tab = src("CalculoCursosHorarioFacultadTab.tsx");
    expect(tab).toContain("<th>Tasa de efectividad</th>");
    expect(tab).toContain("tasa de\n              efectividad de la facultad) → titulares");
    // La jerga enterrada no vuelve.
    expect(tab).not.toContain("publicados por R");
    expect(tab).not.toContain("Método R");
  });

  it("las tarjetas de la pestaña no hablan del τ global muerto", () => {
    for (const f of ["TasaEfectividadFacultadCard.tsx", "DistribucionElegiblesCard.tsx", "CertezaCoberturaPanel.tsx"]) {
      expect(src(f), `τ en ${f}`).not.toMatch(/τ/);
    }
  });

  it("el idioma es titulares, no cupos", () => {
    expect(src("TasaEfectividadFacultadCard.tsx")).not.toContain("cupos de aula");
    expect(src("TasaEfectividadFacultadCard.tsx")).toContain("titulares");
  });
});
