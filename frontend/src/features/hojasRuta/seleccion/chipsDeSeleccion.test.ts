import { describe, expect, test } from "vitest";
import { chipsDeSeleccion } from "./chipsDeSeleccion";

describe("chipsDeSeleccion", () => {
  test("las cuotas llevan su base y avisan cuando no cuadran", () => {
    expect(chipsDeSeleccion({ total_asignado: 1200, n_objetivo: 1200 }, null)).toEqual([
      { id: "cuotas", label: "cuotas", valor: 1200, base: 1200, rank: 1, tono: "ok" },
    ]);
    expect(chipsDeSeleccion({ total_asignado: 1180, n_objetivo: 1200 }, null)[0].tono).toBe("warn");
  });

  test("sin muestra sorteada no hay chips de titulares ni reemplazos", () => {
    expect(chipsDeSeleccion(null, null)).toEqual([]);
  });

  test("con muestra cuenta titulares, entrevistas y reemplazos", () => {
    const chips = chipsDeSeleccion(
      { total_asignado: 1200, n_objetivo: 1200 },
      { n_blocks: 150, n_replacement_blocks: 150, total_entrevistas: 1200 },
    );
    expect(chips.map((chip) => [chip.id, chip.valor])).toEqual([
      ["cuotas", 1200], ["titulares", 150], ["entrevistas", 1200], ["reemplazos", 150],
    ]);
  });
});
