import { describe, expect, it } from "vitest";
import { CASOS_POR_DEFECTO } from "./casosJunto";
import { cifra, ejemploRedondeo, lecturaBase, lecturaCasos, lecturaOtros, redondearBarra } from "./modeloLecturaRegla";

// R8: «Cómo se lee» calcula lo que la regla produce, con los criterios del motor.
describe("lectura de las reglas", () => {
  // Mata: un reparto que no cierre en 100 o un estándar que «arregle» la suma.
  it("estándar redondea cada cifra sola; reparto cierra cada barra en 100", () => {
    expect(redondearBarra([17, 17, 18], "estandar", 0)).toEqual([33, 33, 35]);   // 32.7 + 32.7 + 34.6 → 101
    expect(redondearBarra([17, 17, 18], "reparto", 0).reduce((a, b) => a + b)).toBe(100);
    expect(redondearBarra([17, 17, 18], "reparto", 1).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    expect(redondearBarra([0, 0], "reparto", 0)).toEqual([0, 0]);
  });

  // Mata: una nota que ignore el modo, o que salga con reparto en «sólo si no cierra».
  it("la nota va según su modo y su texto propio manda", () => {
    const std = ejemploRedondeo("estandar", 0, "si_no_cierra", "");
    expect(std.filas.some((f) => !f.cierra)).toBe(true);
    expect(std.lleva).toBe(true);
    expect(std.nota).toContain("pueden no sumar exactamente 100 %");
    expect(ejemploRedondeo("reparto", 0, "si_no_cierra", "").lleva).toBe(false);
    expect(ejemploRedondeo("reparto", 0, "si_no_cierra", "").motivo).toContain("suman 100 %");
    expect(ejemploRedondeo("estandar", 0, "nunca", "").motivo).toContain("así lo pide la regla");
    expect(ejemploRedondeo("reparto", 0, "siempre", "Nota mía").nota).toBe("Nota mía");
    expect(cifra(32.7, 1)).toBe("32.7");
  });

  it("casos, base y «Otros» dicen lo que sale en la lámina", () => {
    expect(lecturaCasos(CASOS_POR_DEFECTO, 0).grande).toBe("43% (12)");
    expect(lecturaCasos({ cuando: "nunca", umbral: 30 }, 2)).toEqual({ grande: "43%", detalle: "Ningún porcentaje lleva sus casos. 2 gráficos tienen la suya." });
    expect(lecturaBase("Base: %s", "docentes", [], {}).grande).toBe("Base: 120 docentes");
    expect(lecturaBase("Base: %s", "", ["docentes", "estudiantes_2018"], {}).grande).toBe("Base: 52 docentes y 140 estudiantes 2018");
    expect(lecturaBase("Base: %s", "", ["docentes", "estudiantes_2018"], { docentes: "profesores" }))
      .toEqual({ grande: "Base: 52 profesores y 140 estudiantes 2018", detalle: "Una palabra elegida para cada base" });
    expect(lecturaOtros(false).grande).toBe("Sin lámina de Otros");
    expect(lecturaOtros(true).grande).toContain("después de su gráfico");
  });
});
