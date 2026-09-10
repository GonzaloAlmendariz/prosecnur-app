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
