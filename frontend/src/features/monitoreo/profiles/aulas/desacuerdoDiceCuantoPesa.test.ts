import { describe, expect, it } from "vitest";
import { agendamiento } from "./agendamiento";

/**
 * Nueve cursos-horario están «agendada» en lo operativo y «sin contactar» en la
 * muestra. El KPI ya los contaba; lo que no decía es cuánto depende de ellos.
 *
 * Medido en HSVG2026 el 2026-08-30: esas 9 aportan **168 de las 373,5 efectivas
 * del aporte pendiente, el 45 %**. La proyección de cierre se apoya en filas
 * cuyos dos estados no se ponen de acuerdo, y cuál de los dos manda —lo agendado
 * o lo contactado— decide si esas encuestas cuentan. Un conteo sin su peso deja
 * al lector sin saber si son nueve casos sueltos o media proyección.
 */
const fila = (sample: string, op: string, esperadas: number) => ({
  sample_status: sample, operational_status: op, expected_valid: esperadas,
  operational_code: `CH ${esperadas}`, faculty: "EDUCACION",
}) as never;

describe("la contradicción de estados dice cuánto pesa", () => {
  it("suma las esperadas de las filas contradictorias", () => {
    const r = agendamiento([
      fila("sin_contactar", "agendada", 20),
      fila("sin_contactar", "aplicada", 15),
      // Coherente: no cuenta ni en el conteo ni en el peso.
      fila("agendada", "agendada", 99),
    ]);
    expect(r.estadosEnDesacuerdo).toBe(2);
    expect(r.esperadasEnDesacuerdo).toBe(35);
  });

  it("sin contradicciones el peso es cero, no un número suelto", () => {
    const r = agendamiento([fila("agendada", "agendada", 99)]);
    expect(r.estadosEnDesacuerdo).toBe(0);
    expect(r.esperadasEnDesacuerdo).toBe(0);
  });

  it("una contradictoria sin esperadas cuenta en el conteo pero no infla el peso", () => {
    const r = agendamiento([fila("sin_contactar", "agendada", 0)]);
    expect(r.estadosEnDesacuerdo).toBe(1);
    expect(r.esperadasEnDesacuerdo).toBe(0);
  });
});
