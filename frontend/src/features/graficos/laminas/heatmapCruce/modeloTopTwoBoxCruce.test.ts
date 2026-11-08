import { describe, expect, it } from "vitest";
import { estadoTopTwoBoxCruce, leerTopTwoBoxCruce, parcheTopTwoBoxCruce } from "./modeloTopTwoBoxCruce";

describe("Top Two Box del mapa de calor por cruce", () => {
  it("sin nada guardado es automático y sin categorías", () => {
    expect(leerTopTwoBoxCruce({})).toEqual({ modo: "auto", etiquetas: [] });
  });

  it("lee sólo de overrides: lo suelto en args no lo dibuja el motor", () => {
    expect(leerTopTwoBoxCruce({ top2box: false, top2box_labels: ["A"] })).toEqual({ modo: "auto", etiquetas: [] });
    expect(leerTopTwoBoxCruce({ overrides: { top2box: false } }).modo).toBe("no");
    expect(leerTopTwoBoxCruce({ overrides: { top2box: "true", top2box_labels: "De acuerdo, Totalmente de acuerdo" } }))
      .toEqual({ modo: "si", etiquetas: ["De acuerdo", "Totalmente de acuerdo"] });
  });

  it("escribe en overrides y conserva lo demás de overrides", () => {
    const args = { overrides: { etiquetas_vars: { p1: "Corta" } } };
    expect(parcheTopTwoBoxCruce(args, { modo: "no" })).toEqual({ overrides: { etiquetas_vars: { p1: "Corta" }, top2box: false } });
    expect(parcheTopTwoBoxCruce(args, { etiquetas: ["De acuerdo"] }))
      .toEqual({ overrides: { etiquetas_vars: { p1: "Corta" }, top2box_labels: ["De acuerdo"] } });
  });

  it("volver a automático y vaciar las categorías borra las claves; sin nada más, overrides sale en null", () => {
    const args = { overrides: { top2box: true, top2box_labels: ["A"] } };
    expect(parcheTopTwoBoxCruce(args, { modo: "auto", etiquetas: [] })).toEqual({ overrides: null });
  });

  it("encendida sin categorías avisa que la columna no sale", () => {
    expect(estadoTopTwoBoxCruce({ modo: "si", etiquetas: [] })).toMatch(/no sale/);
    expect(estadoTopTwoBoxCruce({ modo: "auto", etiquetas: [] })).toBeNull();
    expect(estadoTopTwoBoxCruce({ modo: "no", etiquetas: [] })).toBeNull();
  });
});
