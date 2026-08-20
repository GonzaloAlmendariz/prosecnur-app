import { describe, expect, it } from "vitest";
import { tasasFacultad } from "../tasaFacultadModel";

const RAW = [
  { facultad: "ARQUITECTURA Y URBANISMO", tasa: 0.5489, n_aulas: 80, elegibles: 2468, con_residual: false, facultad_k: null },
  { facultad: "DERECHO", tasa: 0.5679, n_aulas: 411, elegibles: 16397, con_residual: true, facultad_k: 16 },
  // fila coja: sin tasa — el normalizador la descarta entera
  { facultad: "ROTA", n_aulas: 5 },
];

const ESTRATOS = [
  { estrato: "ARQUITECTURA Y URBANISMO", cuota: 125, avg_conglomerado: 21, aulas_base: 11, tau: 0.5489 },
  { estrato: "DERECHO", cuota: 363, avg_conglomerado: 40, aulas_base: 16, tau: 0.5679 },
];

describe("tasasFacultad", () => {
  it("junta la tasa publicada con el estrato y reproduce la aritmética del motor", () => {
    const filas = tasasFacultad(RAW, ESTRATOS);
    expect(filas).toHaveLength(2);
    const der = filas[0]; // orden por cuota desc
    expect(der.facultad).toBe("DERECHO");
    expect(der.conResidual).toBe(true);
    expect(der.k).toBe(16);
    // ceil(363/(40×0,5679)) = ceil(15,98) = 16 = cupos del motor.
    expect(der.cupos).toBe(16);
    expect(der.cuentaCuadra).toBe(true);
    const arq = filas[1];
    // ceil(125/(21×0,5489)) = ceil(10,84) = 11.
    expect(arq.cuentaCuadra).toBe(true);
    expect(arq.conResidual).toBe(false);
    expect(arq.k).toBeNull();
  });

  it("un descuadre motor↔cuenta se DECLARA, no se maquilla", () => {
    const filas = tasasFacultad(RAW, [
      { estrato: "DERECHO", cuota: 363, avg_conglomerado: 40, aulas_base: 99, tau: 0.5679 },
    ]);
    const der = filas.find((f) => f.facultad === "DERECHO")!;
    expect(der.cuentaCuadra).toBe(false);
  });

  it("sin estrato la fila existe con la tasa pero sin aritmética (null, no 0)", () => {
    const filas = tasasFacultad(RAW, null);
    const der = filas.find((f) => f.facultad === "DERECHO")!;
    expect(der.cuota).toBeNull();
    expect(der.cupos).toBeNull();
    expect(der.cuentaCuadra).toBeNull();
  });

  it("payload basura → lista vacía (nunca revienta)", () => {
    expect(tasasFacultad(undefined, ESTRATOS)).toEqual([]);
    expect(tasasFacultad("x", ESTRATOS)).toEqual([]);
    expect(tasasFacultad([{ facultad: "", tasa: 0.5 }], ESTRATOS)).toEqual([]);
  });
});
