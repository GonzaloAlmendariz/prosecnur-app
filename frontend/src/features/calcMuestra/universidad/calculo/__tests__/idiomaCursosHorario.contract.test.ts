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
    // MUDADO 2026-08-21: la cadena dejó de ser un párrafo dentro del tab y es
    // un diagrama propio (Gonzalo: «hay un cuadro de texto gigante llamado "la
    // cadena completa por facultad"; debería explicarse de forma más dinámica»).
    // El contrato es el mismo —la cadena no se rompe—, sólo cambió de casa.
    const cadena = src("CadenaFormulaFacultad.tsx");
    expect(cadena).toContain("cuota");
    expect(cadena).toContain("tasa de efectividad");
    expect(cadena).toContain("titulares");
    expect(tab).toContain("<CadenaFormulaFacultad");
    // El divisor se lee de la decisión del analista, nunca escrito a mano.
    expect(tab).toContain("etiquetaAlumnosPorChMetodo(model.decision.estadistico_default)");
    // La jerga enterrada no vuelve.
    expect(tab).not.toContain("publicados por R");
    expect(tab).not.toContain("Método R");
    expect(cadena).not.toContain("Método R");
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
