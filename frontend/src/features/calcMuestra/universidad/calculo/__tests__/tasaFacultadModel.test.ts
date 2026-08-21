import { describe, expect, it } from "vitest";
import { tasasFacultad, origenTasaFacultades } from "../tasaFacultadModel";

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

describe("origen de la tasa cuando el estudio no trae datos propios", () => {
  /**
   * Medido en el recorrido de un usuario nuevo: sin histórico cargado, TODAS
   * las facultades mostraban «53,0 %» con el chip «derivada de su mix de
   * tamaños». No está derivada de nada: es la tasa de referencia heredada del
   * preset, plana. La etiqueta prometía un cálculo propio del estudio que no
   * ocurrió.
   */
  it("marca «general» cuando ninguna tiene residual y todas comparten la misma tasa", () => {
    const filas = [
      { facultad: "A", tasa: 0.53, conResidual: false },
      { facultad: "B", tasa: 0.53, conResidual: false },
      { facultad: "C", tasa: 0.53, conResidual: false },
    ];
    expect(origenTasaFacultades(filas)).toBe("general");
  });

  it("marca «mix» cuando las tasas difieren entre facultades", () => {
    const filas = [
      { facultad: "A", tasa: 0.61, conResidual: false },
      { facultad: "B", tasa: 0.48, conResidual: false },
    ];
    expect(origenTasaFacultades(filas)).toBe("mix");
  });

  it("marca «historico» en cuanto alguna trae residual medido", () => {
    const filas = [
      { facultad: "A", tasa: 0.53, conResidual: true },
      { facultad: "B", tasa: 0.53, conResidual: false },
    ];
    expect(origenTasaFacultades(filas)).toBe("historico");
  });
});
