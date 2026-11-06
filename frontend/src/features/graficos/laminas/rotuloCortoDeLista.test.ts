import { describe, expect, it } from "vitest";
import { rotuloVisible } from "./rotuloCortoDeLista";

// U14 del checklist de mandos del mazo (2026-11-05): las listas de la tarjeta muestran el corto del estudio.
const MAPA = { "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)": "Académica" };

describe("rotuloVisible", () => {
  it("con corto declarado se ve el corto y el completo queda aparte", () => {
    const r = rotuloVisible(MAPA, "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)");
    expect(r).toEqual({ texto: "Académica", completo: "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)" });
  });

  it("compara el rótulo entero, sin importar espacios de más", () => {
    expect(rotuloVisible(MAPA, "Académica  (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros) ").texto).toBe("Académica");
    expect(rotuloVisible(MAPA, "Académica").completo).toBeNull();
  });

  it("sin mapa, sin corto o con un corto vacío se ve el completo", () => {
    expect(rotuloVisible(undefined, "Sí")).toEqual({ texto: "Sí", completo: null });
    expect(rotuloVisible({ "Sí": "  " }, "Sí")).toEqual({ texto: "Sí", completo: null });
  });
});
