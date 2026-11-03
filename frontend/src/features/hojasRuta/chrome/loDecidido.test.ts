import { describe, expect, test } from "vitest";
import { indicadoresDecididos } from "./loDecidido";

describe("indicadoresDecididos", () => {
  test("la corrida de acnur_acg: 6 distritos, N 1.200 al ±2,8 % y 150 + 150 UMP", () => {
    const ind = indicadoresDecididos({ distritos: 6, poblacion: 3114851, n: 1200, margen: 0.0283, titulares: 150, reemplazos: 150 });
    expect(ind.map((i) => [i.label, i.value, i.seccion])).toEqual([
      ["Territorio", "6 distritos", "territorio"],
      ["Población", "3.11 M", "poblacion"],
      ["Muestra", "N 1,200, ±2.8 %", "muestra"],
      ["UMP", "150 + 150 R", "manzanas"],
    ]);
    // Con la matriz calculada, la población es la objetivo (brecha B2).
    expect(indicadoresDecididos({ distritos: 6, poblacion: 3114851, poblacionObjetivo: 2391902, n: 1200, margen: 0.0283, titulares: 150, reemplazos: 150 })[1].value).toBe("2.39 M");
  });

  test("lo que todavía no se decidió se dice con palabras, no con ceros", () => {
    const ind = indicadoresDecididos({ distritos: 0, poblacion: 0, n: null, margen: null, titulares: null, reemplazos: null });
    expect(ind.map((i) => i.value)).toEqual(["Por elegir", "Por calcular", "Por definir", "Por sortear"]);
  });

  test("sin margen conocido muestra solo el N", () => {
    expect(indicadoresDecididos({ distritos: 1, poblacion: 10, n: 400, margen: null, titulares: null, reemplazos: null })[2].value).toBe("N 400");
  });
});
