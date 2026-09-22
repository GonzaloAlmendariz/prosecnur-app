import { describe, expect, it } from "vitest";

import { respuestasDeLaFacultad, type DesgloseDeRespuestas } from "./respuestasDeLaFacultad";

const desglose: DesgloseDeRespuestas = {
  total: { observadas: 1049, efectivas: 944, fuera_del_operativo: 37, no_pasan_criterio: 68, sin_aula: 38 },
  facultades: [
    { facultad: "DERECHO", observadas: 55, efectivas: 51, fuera_del_operativo: 0, no_pasan_criterio: 4 },
    { facultad: "LETRAS", observadas: 10, efectivas: 9, fuera_del_operativo: 1, no_pasan_criterio: 0 },
  ],
};

describe("qué cuenta enseña el bloque de respuestas", () => {
  it("sin foco, la del conjunto, con sus respuestas sin aula", () => {
    const r = respuestasDeLaFacultad(desglose, undefined);
    expect(r?.cuenta?.efectivas).toBe(944);
    expect(r?.sinAula).toBe(38);
    expect(r?.rotulo).toBe("");
  });

  it("con una facultad en foco, la suya — y «sin aula» deja de aplicar", () => {
    // Una facultad no tiene respuestas «sin aula»: por definición, las que no
    // se pudieron atribuir no están en ninguna.
    const r = respuestasDeLaFacultad(desglose, "DERECHO");
    expect(r?.cuenta?.efectivas).toBe(51);
    expect(r?.sinAula).toBe(0);
    expect(r?.rotulo).toBe("DERECHO");
  });

  it("el foco casa sin importar mayúsculas ni espacios", () => {
    expect(respuestasDeLaFacultad(desglose, "  derecho ")?.cuenta?.efectivas).toBe(51);
  });

  it("una facultad sin ninguna respuesta enseña SUS ceros, no el total", () => {
    // Decir «944 efectivas» bajo el rótulo de una facultad sin respuestas sería
    // mentir con una cifra correcta.
    const r = respuestasDeLaFacultad(desglose, "EDUCACION");
    expect(r?.cuenta?.observadas).toBe(0);
    expect(r?.rotulo).toBe("EDUCACION");
  });

  it("sin desglose no hay bloque", () => {
    expect(respuestasDeLaFacultad(null, "DERECHO")).toBeNull();
    expect(respuestasDeLaFacultad(undefined, undefined)).toBeNull();
  });
});

describe("la nota cuadra con el total que el panel enseña", () => {
  /**
   * El panel titula en EFECTIVAS y su tabla de facultades también, así que la
   * resta que la nota explica es sobre efectivas. `sin_aula` cuenta sobre
   * observadas: coinciden mientras nada se descarte, y divergen en cuanto el
   * estudio declara `descartes`.
   *
   * Medido el 2026-09-22 en CCSS Perfil 2026-II al descartar los QR de
   * «CAPACITACION» y «PRUEBA»: cabecera «21 efectivas de 29 respuestas», única
   * facultad con 10, y la nota diciendo «19 … cuentan en el total» con 8 de
   * ellas ya fuera.
   */
  const desglose = {
    total: {
      observadas: 29, efectivas: 21, fuera_del_operativo: 8, no_pasan_criterio: 0,
      sin_aula: 19, sin_aula_efectivas: 11,
    },
    facultades: [
      { facultad: "CIENCIAS SOCIALES", observadas: 10, efectivas: 10, fuera_del_operativo: 0, no_pasan_criterio: 0 },
    ],
  };

  it("usa la cuenta sobre efectivas, que es la que cierra la resta", () => {
    const v = respuestasDeLaFacultad(desglose, undefined);
    expect(v?.sinAula).toBe(11);
    const efectivasFacultades = desglose.facultades.reduce((n, f) => n + f.efectivas, 0);
    expect((v?.cuenta?.efectivas ?? 0) - efectivasFacultades).toBe(v?.sinAula);
  });

  it("un payload anterior sin el campo cae a sin_aula y no se rompe", () => {
    const viejo = { ...desglose, total: { ...desglose.total, sin_aula_efectivas: undefined } };
    expect(respuestasDeLaFacultad(viejo, undefined)?.sinAula).toBe(19);
  });
});
