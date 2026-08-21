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

  it("el desglose de la tasa sólo se ofrece si RECONSTRUYE la tasa mostrada", () => {
    // Gonzalo pidió ver de dónde sale cada tasa. La condición innegociable es
    // que los factores den el número que la fila enseña al lado; si no, la
    // pantalla estaría mostrando una cuenta falsa.
    const conDesglose = tasasFacultad(
      [
        // DERECHO: 0,509776 × 1,114 ≈ 0,5679 — cuadra.
        { facultad: "DERECHO", tasa: 0.5679, n_aulas: 411, elegibles: 16397, con_residual: true, facultad_k: 16, rendimiento_mix: 0.509785, factor_residual: 1.114 },
        // ARQUITECTURA sin residual propio: factor exactamente 1.
        { facultad: "ARQUITECTURA Y URBANISMO", tasa: 0.5489, n_aulas: 80, elegibles: 2468, con_residual: false, facultad_k: null, rendimiento_mix: 0.5489, factor_residual: 1 },
      ],
      ESTRATOS,
    );
    const der = conDesglose.find((f) => f.facultad === "DERECHO")!;
    expect(der.residual).toBe(1.114);
    expect(der.mix).toBeCloseTo(0.509785, 6);
    expect(der.mix! * der.residual!).toBeCloseTo(der.tasa, 3);
    const arq = conDesglose.find((f) => f.facultad === "ARQUITECTURA Y URBANISMO")!;
    // Factor 1 = «el histórico no dio base propia»: es información, no ruido.
    expect(arq.residual).toBe(1);
    expect(arq.mix).toBe(arq.tasa);

    // Factores que NO reconstruyen la tasa: se anulan en vez de mostrarse.
    const mentiroso = tasasFacultad(
      [{ facultad: "DERECHO", tasa: 0.5679, n_aulas: 411, elegibles: 16397, con_residual: true, facultad_k: 16, rendimiento_mix: 0.2, factor_residual: 1.114 }],
      ESTRATOS,
    );
    expect(mentiroso[0].mix).toBeNull();
    expect(mentiroso[0].residual).toBeNull();

    // EL CASO QUE SÓLO EL MODELO PUEDE ATRAPAR: los factores reconstruyen la
    // tasa DEL MARCO, pero la que se muestra es la SELLADA EN EL ESTRATO y son
    // distintas. El normalizador los da por buenos —cuadran con su tasa—, así
    // que sin esta comprobación la fila enseñaría 0,509785 × 1,114 al lado de
    // un 40,0 % que esos factores no producen.
    const selladaDistinta = tasasFacultad(
      [{ facultad: "DERECHO", tasa: 0.5679, n_aulas: 411, elegibles: 16397, con_residual: true, facultad_k: 16, rendimiento_mix: 0.509785, factor_residual: 1.114 }],
      [{ estrato: "DERECHO", cuota: 363, avg_conglomerado: 40, aulas_base: 23, tau: 0.4 }],
    );
    expect(selladaDistinta[0].tasa).toBe(0.4);
    expect(selladaDistinta[0].mix).toBeNull();
    expect(selladaDistinta[0].residual).toBeNull();

    // Motor viejo que no publica los factores: la fila vive igual, sin desglose.
    const viejo = tasasFacultad(RAW, ESTRATOS);
    expect(viejo[0].mix).toBeNull();
    expect(viejo[0].residual).toBeNull();
    expect(viejo[0].cupos).toBe(16);
  });

  it("sin cuota ordena por PESO, no por tasa, y marca el respaldo fino", () => {
    // Gonzalo, mirando la lista sin calcular: la encabezaba ESCUELA DE
    // ESTUDIOS ESPECIALES —2 aulas, 44 elegibles— por tener la tasa más alta,
    // encima de facultades de 578 aulas. Un ranking donde no lo hay.
    const filas = tasasFacultad(
      [
        { facultad: "ESCUELA DE ESTUDIOS ESPECIALES", tasa: 0.69, n_aulas: 2, elegibles: 44, con_residual: false, facultad_k: null },
        { facultad: "CIENCIAS E INGENIERIA", tasa: 0.5747, n_aulas: 702, elegibles: 22553, con_residual: false, facultad_k: null },
        { facultad: "LETRAS Y CIENCIAS HUMANAS", tasa: 0.6795, n_aulas: 16, elegibles: 327, con_residual: false, facultad_k: null },
      ],
      null,
    );
    expect(filas.map((f) => f.facultad)).toEqual([
      "CIENCIAS E INGENIERIA",
      "LETRAS Y CIENCIAS HUMANAS",
      "ESCUELA DE ESTUDIOS ESPECIALES",
    ]);
    // Y la de dos aulas lo dice: la tasa existe, su respaldo es fino.
    expect(filas[2].respaldoFino).toBe(true);
    expect(filas[2].nAulasMarco).toBe(2);
    expect(filas[0].respaldoFino).toBe(false);
    // 16 aulas ya pasa el umbral de 12 con el que el motor cree al histórico.
    expect(filas[1].respaldoFino).toBe(false);
  });

  it("con la muestra calculada manda la cuota, no los elegibles", () => {
    const filas = tasasFacultad(RAW, ESTRATOS);
    // DERECHO tiene menos aulas que ARQUITECTURA en el fixture pero más cuota.
    expect(filas[0].facultad).toBe("DERECHO");
    expect(filas[0].cuota).toBe(363);
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
