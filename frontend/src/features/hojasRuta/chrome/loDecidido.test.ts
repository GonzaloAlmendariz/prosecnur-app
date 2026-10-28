import { describe, expect, test } from "vitest";
import { indicadoresDecididos } from "./loDecidido";

describe("indicadoresDecididos", () => {
  test("la corrida de acnur_acg: 6 distritos, N 1.200 al ±2,8 % y 150 + 150 UMP", () => {
    const ind = indicadoresDecididos({ distritos: 6, poblacion: 3114851, n: 1200, margen: 0.0283, titulares: 150, reemplazos: 150 });
    expect(ind.map((i) => [i.label, i.value, i.seccion])).toEqual([
      ["Territorio", "6 distritos", "territorio"],
      ["Muestra", "N 1,200 · ±2.8 %", "muestra"],
      ["UMP", "150 + 150", "manzanas"],
      ["Población", "3,114,851", "poblacion"],
    ]);
  });

  test("lo que todavía no se decidió se dice con palabras, no con ceros", () => {
    const ind = indicadoresDecididos({ distritos: 0, poblacion: 0, n: null, margen: null, titulares: null, reemplazos: null });
    expect(ind.map((i) => i.value).slice(0, 3)).toEqual(["Por elegir", "Por definir", "Por sortear"]);
  });

  test("sin margen conocido muestra solo el N", () => {
    expect(indicadoresDecididos({ distritos: 1, poblacion: 10, n: 400, margen: null, titulares: null, reemplazos: null })[1].value).toBe("N 400");
  });
});
