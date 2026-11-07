import { describe, expect, test } from "vitest";
import { calcularTamano } from "./motorTamano";
import { pasosDelN } from "./pasosDelN";

const P = { confianza: 0.95, margenTotal: 0.05, margenDistrito: 0.1, p: 0.5, deff: 1.5, asignacion: "proportional" as const, piso: false, respuesta: 0.9, fpc: true };
const distritos = [
  { ubigeo: "150103", distrito: "ATE", poblacion: 400000 },
  { ubigeo: "150108", distrito: "CHORRILLOS", poblacion: 200000 },
];

describe("¿De dónde sale este N? (P7 de la paridad)", () => {
  test("los pasos llegan al mismo N total que el motor", () => {
    for (const porRuta of [1, 8]) {
      for (const fpc of [true, false]) {
        const r = calcularTamano({ distritos, parametros: { ...P, fpc }, modo: "calculator", nTotal: 0, nPorDistrito: {}, porRuta });
        const { n, pasos } = pasosDelN({ z: r.z, p: P.p, margenTotal: P.margenTotal, deff: P.deff, fpc, poblacion: r.poblacionTotal, porRuta, piso: false, margenDistrito: P.margenDistrito, sumaMinimos: r.sumaMinimos });
        expect(n).toBe(r.nTotalMinimo);
        expect(pasos[0].formula).toContain("z²");
      }
    }
  });

  test("con la garantía por distrito, manda la suma de mínimos y se dice", () => {
    const r = calcularTamano({ distritos, parametros: { ...P, piso: true }, modo: "calculator", nTotal: 0, nPorDistrito: {}, porRuta: 8 });
    const { n, pasos } = pasosDelN({ z: r.z, p: P.p, margenTotal: P.margenTotal, deff: P.deff, fpc: true, poblacion: r.poblacionTotal, porRuta: 8, piso: true, margenDistrito: P.margenDistrito, sumaMinimos: r.sumaMinimos });
    expect(n).toBe(r.nRecomendado);
    if (r.sumaMinimos > r.nTotalMinimo) expect(pasos.at(-1)?.manda).toBe(true);
  });
});
