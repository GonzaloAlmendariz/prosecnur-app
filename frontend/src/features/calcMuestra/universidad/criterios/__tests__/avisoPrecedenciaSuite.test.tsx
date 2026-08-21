import { describe, expect, it } from "vitest";
import { debeAvisarPrecedenciaSuite } from "../avisoPrecedenciaSuite";

/**
 * Medido con los archivos reales (dos builds en frío): declarar un criterio en
 * UNA facultad mueve las cifras de TODAS. Sin criterios el marco incluye 3.142
 * cursos-horario; con un criterio sólo en Estudios Generales Ciencias, 3.402 —
 * esa facultad baja 26 y las otras quince suben (Generales Letras +120,
 * Posgrado +60, Derecho +19…).
 *
 * El motor lo hace a propósito: con suite activa ELLA es la autoridad y los
 * filtros heredados se neutralizan, para que la suite pueda ampliar y no sólo
 * restringir (calc_muestra_aulas.R, «Precedencia suite ⇒ flags legacy»). Lo que
 * faltaba era decirlo: sin aviso, restringir una facultad y ver crecer el total
 * se lee como un error de cálculo.
 */
describe("debeAvisarPrecedenciaSuite", () => {
  it("avisa cuando hay criterios declarados y el marco está por recalcularse", () => {
    expect(debeAvisarPrecedenciaSuite({ suiteActiva: true, marcoDesactualizado: true })).toBe(true);
  });

  it("no avisa sin criterios declarados: ahí no hay cambio de régimen", () => {
    expect(debeAvisarPrecedenciaSuite({ suiteActiva: false, marcoDesactualizado: true })).toBe(false);
  });

  it("no avisa cuando el marco ya está al día: el cambio ya se aplicó y se vio", () => {
    expect(debeAvisarPrecedenciaSuite({ suiteActiva: true, marcoDesactualizado: false })).toBe(false);
  });
});
