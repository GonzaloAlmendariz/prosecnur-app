import { describe, expect, it } from "vitest";

import { brechasDelCorte, repartoDeBrechas } from "./brechasDelCorte";

/**
 * El diagnóstico que separa el complemento (B) del refuerzo (C). «Rindió poco»
 * no significa nada suelto: poco contra lo que su facultad preveía.
 */
const fila = (f: Record<string, unknown>) => f as never;

const plan = [
  // No se aplicó: le falta todo porque no le ha tocado.
  fila({ operational_code: "CH 61", faculty: "LETRAS", eligible_n: 40, respuestas_validas: 0,
         expected_valid: 30, brecha: 30, tasa_facultad: 0.568, application_status: "pendiente" }),
  // Aplicada y muy por debajo de lo que su facultad preveía.
  fila({ operational_code: "CH 23", faculty: "ARTES", eligible_n: 62, respuestas_validas: 20,
         expected_valid: 46, brecha: 26, tasa_facultad: 0.74, application_status: "aplicada",
         sex_top_1: "F", sex_top_1_n: 40, sex_top_2: "M", sex_top_2_n: 22 }),
  // Aplicada y cerca: rinde el 90 % de lo previsto.
  fila({ operational_code: "CH 84", faculty: "DERECHO", eligible_n: 50, respuestas_validas: 26,
         expected_valid: 28, brecha: 2, tasa_facultad: 0.568, application_status: "aplicada" }),
  // Cumplida: no tiene nada que hacer.
  fila({ operational_code: "CH 95", faculty: "DERECHO", eligible_n: 40, respuestas_validas: 30,
         expected_valid: 22, brecha: 0, tasa_facultad: 0.568, application_status: "aplicada" }),
];

describe("las brechas del corte", () => {
  it("separa la que no se aplicó de la que rindió poco", () => {
    // Un aula a la que no se ha ido no ha fallado: su salida es la agenda.
    const b = brechasDelCorte(plan);
    const porCodigo = Object.fromEntries(b.map((x) => [x.codigo, x]));
    expect(porCodigo["CH 61"].severidad).toBe("sin_aplicar");
    expect(porCodigo["CH 61"].accion).toBe("reemplazo");
    expect(porCodigo["CH 23"].severidad).toBe("muy_por_debajo");
    expect(porCodigo["CH 23"].accion).toBe("complemento");
  });

  it("mide contra la tasa prevista de SU facultad, no contra una media", () => {
    // CH 23 rinde 32 % donde Artes preveía 74: menos de la mitad.
    // CH 84 rinde 52 % donde Derecho preveía 56,8: cerca.
    const b = brechasDelCorte(plan);
    const porCodigo = Object.fromEntries(b.map((x) => [x.codigo, x]));
    expect(porCodigo["CH 84"].severidad).toBe("cerca");
    expect(porCodigo["CH 23"].observada).toBeCloseTo(20 / 62, 3);
    expect(porCodigo["CH 23"].prevista).toBe(0.74);
  });

  it("la que ya cumplió no pide nada", () => {
    const cumplida = brechasDelCorte(plan).find((x) => x.codigo === "CH 95")!;
    expect(cumplida.severidad).toBe("cumplida");
    expect(cumplida.accion).toBe("nada");
  });

  it("ordena por lo que hay que atender primero", () => {
    // Sin aplicar antes que lo corto, y dentro de cada grupo lo que más falta.
    expect(brechasDelCorte(plan).map((x) => x.codigo)).toEqual(["CH 61", "CH 23", "CH 84", "CH 95"]);
  });

  it("trae la composición por sexo: decide si un relevo cerraría lo que falta", () => {
    const ch23 = brechasDelCorte(plan).find((x) => x.codigo === "CH 23")!;
    expect(ch23.mujeres).toBe(40);
    expect(ch23.hombres).toBe(22);
  });

  it("sin tasa prevista no inventa una severidad fina", () => {
    const b = brechasDelCorte([fila({ operational_code: "CH 7", eligible_n: 30,
      respuestas_validas: 5, expected_valid: 20, brecha: 15, application_status: "aplicada" })]);
    expect(b[0].severidad).toBe("por_debajo");
  });

  it("el reparto cuenta lo que hay de cada cosa", () => {
    const r = repartoDeBrechas(brechasDelCorte(plan));
    expect(r.total).toBe(4);
    expect(r.sinAplicar).toBe(1);
    expect(r.muyPorDebajo).toBe(1);
    expect(r.faltanEnTotal).toBe(58);
  });

  it("sin plan devuelve una lista vacía, no se cae", () => {
    expect(brechasDelCorte(null)).toEqual([]);
    expect(repartoDeBrechas([]).total).toBe(0);
  });
});
