import { describe, expect, it } from "vitest";
import { conOpcionCasos, opcionCasos, rotuloComoElInforme } from "./CasosGrafico";
import { opcionesEnSegmentado } from "./opcionesEnSegmentado";

describe("casos junto al % de un gráfico", () => {
  it("sin decisión sigue el informe; Siempre/Nunca van a overrides y «Como el informe» los borra", () => {
    expect(opcionCasos({})).toBe("informe");
    const siempre = conOpcionCasos({ overrides: { titulo: "x" } }, "siempre");
    expect(siempre).toEqual({ overrides: { titulo: "x", mostrar_n_en_etiquetas: true } });
    expect(opcionCasos(siempre)).toBe("siempre");
    expect(opcionCasos(conOpcionCasos(siempre, "nunca"))).toBe("nunca");
    expect(conOpcionCasos(siempre, "informe")).toEqual({ overrides: { titulo: "x" } });
  });

  it("ítem 9: «Como el informe» dice qué rige hoy y las tres caben en el segmentado, debajo del rótulo", () => {
    expect(rotuloComoElInforme("nunca", 30)).toBe("Como el informe (sin casos)");
    expect(rotuloComoElInforme("siempre", 30)).toBe("Como el informe (con casos)");
    expect(rotuloComoElInforme("menos", 25)).toBe("Como el informe (bajo 25)");
    const seg = opcionesEnSegmentado([
      { value: "informe", label: rotuloComoElInforme("nunca", 30) }, { value: "siempre", label: "Siempre" }, { value: "nunca", label: "Nunca" },
    ]);
    expect(seg?.apilado).toBe(true);
  });
});
