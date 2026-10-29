import { describe, expect, test } from "vitest";
import { agregarRango, editarRango, firmaRangos, idRango, PRESETS_EDAD, problemasDeRangos, rango } from "./rangos";

describe("rangos de edad", () => {
  test("el id sigue la regla de R", () => {
    expect(idRango(18, 29)).toBe("18_29");
    expect(idRango(60, null)).toBe("60");
  });

  test("los presets no tienen problemas", () => {
    for (const p of PRESETS_EDAD) expect(problemasDeRangos(p.rangos)).toEqual([]);
  });

  test("detecta hueco, solape, rango al revés, abierto en medio y edades fuera", () => {
    expect(problemasDeRangos([rango(18, 29), rango(32, 44), rango(45, null)]).map((p) => p.texto)).toEqual(["Faltan las edades 30–31"]);
    expect(problemasDeRangos([rango(18, 30), rango(30, null)]).map((p) => p.tipo)).toEqual(["solape"]);
    expect(problemasDeRangos([rango(18, 10), rango(11, null)]).map((p) => p.tipo)).toContain("al-reves");
    expect(problemasDeRangos([rango(18, null), rango(30, null)]).map((p) => p.tipo)).toEqual(["abierto-en-medio"]);
    expect(problemasDeRangos([rango(18, 29), rango(30, 59)]).map((p) => p.texto)).toEqual(["Quedan fuera las edades desde 60"]);
    expect(problemasDeRangos([rango(18, 29), rango(31, null)])[0].texto).toBe("Faltan las edades 30");
  });

  test("editar regenera id y rótulo; agregar cierra el abierto y abre uno nuevo", () => {
    const base = [rango(18, 29), rango(30, null)];
    expect(editarRango(base, 0, "max", 34)[0]).toEqual({ id: "18_34", label: "18-34", min: 18, max: 34 });
    expect(agregarRango(base).map((r) => r.label)).toEqual(["18-29", "30-39", "40+"]);
    expect(firmaRangos(base)).toBe("18-29|30-");
    // el «NA» con que R guarda el tope abierto cuenta como abierto
    expect(firmaRangos([{ id: "60", label: "60+", min: 60, max: "NA" as unknown as null }])).toBe("60-");
  });
});
