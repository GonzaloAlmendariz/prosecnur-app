import { describe, expect, test } from "vitest";

import { tiemposDeRespuesta } from "./tiemposDeRespuesta";

describe("tiempos de respuesta", () => {
  test("un estudio sin marcas de tiempo no desaparece: dice que no las tiene", () => {
    const r = tiemposDeRespuesta({
      disponible: false,
      motivo: "La base no declara ni inicio ni fin de la entrevista.",
      criterio: { declarado: false, leyenda: "Este estudio no ha declarado…" },
      resumen: null,
      por_aula: [],
    });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/ni inicio ni fin/);
    expect(r.resumen).toBeNull();
  });

  test("jsonlite envuelve escalares en arrays de uno y aun asi sale un numero", () => {
    const r = tiemposDeRespuesta({
      disponible: [true],
      motivo: [""],
      columna_inicio: ["start"],
      criterio: { declarado: [true], umbral_min: [5], leyenda: ["…"] },
      resumen: { n: [1283], mediana: [14.12], p25: [8.46], p75: [27.51], p95: [857.12], maximo: [10260.56], cola_min: [120], cola_larga: [92] },
      marcadas: { n: [55], de: [1283] },
      por_aula: [{ grupo: ["smp"], n: [222], mediana: [11.57], banda_inf: [8.98], banda_sup: [14.04], mediana_resto: [14.51], destaca: [true], n_bajo: [false] }],
    });
    expect(r.resumen?.mediana).toBe(14.12);
    expect(r.columnas.inicio).toBe("start");
    expect(r.umbral.minutos).toBe(5);
    expect(r.marcadas).toEqual({ n: 55, de: 1283 });
    expect(r.aulas[0].aula).toBe("smp");
    expect(r.aulas[0].destaca).toBe(true);
  });

  test("sin umbral declarado no hay marcadas, aunque el motor mande el bloque", () => {
    const r = tiemposDeRespuesta({
      disponible: true,
      criterio: { declarado: false, umbral_min: null, leyenda: "…" },
      resumen: { n: 10, mediana: 12 },
      marcadas: { n: 0, de: 10 },
      por_aula: [],
    });
    expect(r.umbral.declarado).toBe(false);
    expect(r.umbral.minutos).toBeNull();
    expect(r.marcadas).toBeNull();
  });

  test("un aula sin mediana no se cuela como cero", () => {
    // Un cero aqui seria «se responde al instante», que es lo contrario de
    // «no se pudo calcular».
    const r = tiemposDeRespuesta({
      disponible: true,
      criterio: { declarado: false },
      resumen: { n: 3, mediana: 12 },
      por_aula: [
        { grupo: "CH 1", mediana: 12, n: 3 },
        { grupo: "CH 2", mediana: null, n: 0 },
        { grupo: "", mediana: 9, n: 2 },
      ],
    });
    expect(r.aulas.map((a) => a.aula)).toEqual(["CH 1"]);
  });

  test("un payload ausente no rompe la vista", () => {
    const r = tiemposDeRespuesta(undefined);
    expect(r.disponible).toBe(false);
    expect(r.aulas).toEqual([]);
    expect(r.resumen).toBeNull();
  });
});
